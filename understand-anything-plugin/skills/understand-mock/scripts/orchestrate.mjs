#!/usr/bin/env node
/**
 * orchestrate.mjs — run the 5-phase pipeline.
 *
 * Phases:
 *   1. page-detector → pages.json
 *   2. api-mapper → api-map.json
 *   3. mock-generator → mocks/*.tsx + seed/*.json
 *   4. annotation-builder → annotations/*.json
 *   5. next dev → serve guidebook
 *
 * Usage:
 *   node orchestrate.mjs [projectDir] [flags]
 */

import fs from "node:fs";
import path from "node:path";
import { spawn, execSync } from "node:child_process";
import { detectPages } from "./page-detector.mjs";
import { mapApiCalls } from "./api-mapper.mjs";
import { generateMocks } from "./mock-generator.mjs";
import { buildAnnotations } from "./annotation-builder.mjs";
import { parseArgs } from "./cli.mjs";

const SCRIPTS_DIR = new URL(".", import.meta.url).pathname;

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function resolveProject(projectDir) {
  const abs = path.resolve(projectDir);
  if (!fs.existsSync(abs)) {
    console.error(`Error: directory not found: ${abs}`);
    process.exit(1);
  }
  return abs;
}

function uaDir(projectDir) {
  const legacy = path.join(projectDir, ".understand-anything");
  if (fs.existsSync(legacy)) return ".understand-anything";
  return ".ua";
}

function mockGuideDir(projectDir) {
  return path.join(projectDir, uaDir(projectDir), "mock-guide");
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

/* ------------------------------------------------------------------ */
/*  Detector: monorepo support                                         */
/* ------------------------------------------------------------------ */

/** Detect monorepo sub-apps (apps/*) */
function detectApps(projectDir) {
  const appsDir = path.join(projectDir, "apps");
  if (!fs.existsSync(appsDir)) return [projectDir]; // not a monorepo

  const apps = [];
  for (const entry of fs.readdirSync(appsDir, { withFileTypes: true })) {
    if (entry.isDirectory() && !entry.name.startsWith(".")) {
      const appDir = path.join(appsDir, entry.name);
      const pkgPath = path.join(appDir, "package.json");
      if (fs.existsSync(pkgPath)) {
        apps.push(appDir);
      }
    }
  }
  return apps.length > 0 ? apps : [projectDir];
}

/* ------------------------------------------------------------------ */
/*  Phase executors                                                    */
/* ------------------------------------------------------------------ */

/** Cross-ref api-map.json into pages.json: populate Page.apiCalls[] */
function crossRefApiCalls(projectDir) {
  const outDir = mockGuideDir(projectDir);
  const pagesPath = path.join(outDir, "pages.json");
  const apiPath = path.join(outDir, "api-map.json");

  if (!fs.existsSync(pagesPath) || !fs.existsSync(apiPath)) return;

  try {
    const pages = JSON.parse(fs.readFileSync(pagesPath, "utf-8"));
    const apiMap = JSON.parse(fs.readFileSync(apiPath, "utf-8"));

    for (const page of pages.pages) {
      const entry = apiMap[page.id];
      page.apiCalls = entry ? entry.calls.map((c) => c.id) : [];
    }

    fs.writeFileSync(pagesPath, JSON.stringify(pages, null, 2), "utf-8");
    console.log(`  → cross-ref: ${pages.pages.length} pages updated with apiCalls[]`);
  } catch (err) {
    console.warn(`  → cross-ref failed: ${err.message}`);
  }
}

function phase1(projectDir, options) {
  console.log(`[1/5] Detecting pages in ${projectDir}...`);
  const result = detectPages(projectDir, { noLlm: options.noLlm, maxPages: options.maxPages });
  const outDir = mockGuideDir(projectDir);
  ensureDir(outDir);
  const pagesPath = path.join(outDir, "pages.json");
  fs.writeFileSync(pagesPath, JSON.stringify(result, null, 2), "utf-8");
  console.log(`  → ${result.pages.length} pages detected (framework: ${result.framework})`);
  return result;
}

function phase2(projectDir, options) {
  console.log(`[2/5] Mapping API calls in ${projectDir}...`);
  const result = mapApiCalls(projectDir, { noLlm: options.noLlm });
  const outDir = mockGuideDir(projectDir);
  const apiPath = path.join(outDir, "api-map.json");
  fs.writeFileSync(apiPath, JSON.stringify(result, null, 2), "utf-8");

  // Verify api-map.json was written
  if (!fs.existsSync(apiPath)) {
    console.error(`✗ api-map.json not found at ${apiPath}`);
    process.exit(1);
  }

  let totalCalls = 0;
  let pagesWithCalls = 0;
  for (const pageId of Object.keys(result)) {
    if (result[pageId].calls.length > 0) {
      totalCalls += result[pageId].calls.length;
      pagesWithCalls++;
    }
  }
  console.log(`  → ${totalCalls} API calls mapped across ${pagesWithCalls}/${Object.keys(result).length} pages`);
  return result;
}

function phase3(projectDir, options) {
  console.log(`[3/5] Generating mocks for ${projectDir}...`);
  const result = generateMocks(projectDir, options);

  // Verify every page has a mock file
  const pagesPath = path.join(mockGuideDir(projectDir), "pages.json");
  const mocksDir = path.join(mockGuideDir(projectDir), "mocks");
  try {
    const pagesJson = JSON.parse(fs.readFileSync(pagesPath, "utf-8"));
    const pages = pagesJson.pages || [];
    const missing = [];
    for (const page of pages) {
      const mockPath = path.join(mocksDir, `${page.id}.tsx`);
      if (!fs.existsSync(mockPath)) {
        missing.push(page.id);
      }
    }
    if (missing.length > 0) {
      console.error(`✗ Missing mocks for ${missing.length} pages: ${missing.join(", ")}`);
      process.exit(1);
    }
  } catch (err) {
    console.warn(`  → verification warning: ${err.message}`);
  }

  console.log(`  → ${result.mocks} mocks, ${result.seeds} seed files`);
  return result;
}

function phase4(projectDir, options) {
  console.log(`[4/5] Building annotations for ${projectDir}...`);
  const result = buildAnnotations(projectDir, { noLlm: options.noLlm });
  const annotationsDir = path.join(mockGuideDir(projectDir), "annotations");
  fs.mkdirSync(annotationsDir, { recursive: true });

  let totalNodes = 0;
  for (const ann of result) {
    const outPath = path.join(annotationsDir, `${ann.pageId}.json`);
    fs.writeFileSync(outPath, JSON.stringify(ann, null, 2), "utf-8");
    totalNodes += ann.nodes.length;
  }

  // Verify annotations were written
  const writtenFiles = fs.readdirSync(annotationsDir).filter((f) => f.endsWith(".json"));
  if (writtenFiles.length === 0) {
    console.error(`✗ No annotation files written to ${annotationsDir}`);
    process.exit(1);
  }

  console.log(`  → ${writtenFiles.length} annotation files, ${totalNodes} nodes`);
  return result;
}

/** Copy generated mocks into src/mocks/generated/ for live import */
function copyMocksToGenerated(projectDir) {
  const srcDir = path.join(mockGuideDir(projectDir), "mocks");
  const nextDir = path.resolve(new URL("../../../packages/mock-guide/src/mocks/generated", import.meta.url).pathname);
  const outDir = path.resolve(new URL("../../../packages/mock-guide", import.meta.url).pathname);

  if (!fs.existsSync(srcDir)) {
    console.warn(`  → no mocks to copy (${srcDir} not found)`);
    return;
  }

  fs.mkdirSync(nextDir, { recursive: true });

  const mockFiles = fs.readdirSync(srcDir).filter((f) => f.endsWith(".tsx"));
  for (const f of mockFiles) {
    fs.copyFileSync(path.join(srcDir, f), path.join(nextDir, f));
  }

  // Write an index.ts with the import map
  const imports = mockFiles.map((f) => {
    const pageId = f.replace(/\.tsx$/, "");
    return `  "${pageId}": () => import("./${pageId}")`;
  }).join(",\n");

  const indexPath = path.join(outDir, "src/mocks/generated/index.ts");
  fs.writeFileSync(indexPath, `// Auto-generated by orchestrate.mjs — do not edit manually
import type { FC } from "react";

export const mockLoaders: Record<string, () => Promise<{ default: FC<any> }>> = {
${imports}
};
`, "utf-8");

  console.log(`  → copied ${mockFiles.length} mocks to generated/, wrote index.ts`);
}

function phase5(projectDir, options) {
  console.log(`[5/5] Serving guidebook...`);

  copyMocksToGenerated(projectDir);

  const host = "127.0.0.1";
  const port = options.port ?? 5174;

  // Start next dev
  const nextDir = path.resolve(new URL("../../../packages/mock-guide", import.meta.url).pathname);
  const child = spawn("pnpm", ["dev"], {
    cwd: nextDir,
    env: {
      ...process.env,
      MOCK_GUIDE_PROJECT_ROOT: projectDir,
      HOSTNAME: host,
      PORT: String(port),
    },
    stdio: ["inherit", "pipe", "pipe"],
  });

  child.stdout.on("data", (data) => {
    const text = data.toString();
    process.stdout.write(text);
    // Look for the token URL
    const tokenMatch = text.match(/http:\/\/127\.0\.0\.1:\d+\/\?token=([a-f0-9]+)/);
    if (tokenMatch) {
      console.log(`\n✓ Mock guide ready at http://127.0.0.1:${port}/?token=${tokenMatch[1]}\n`);
    }
  });
  child.stderr.on("data", (data) => process.stderr.write(data.toString()));

  return child;
}

/* ------------------------------------------------------------------ */
/*  Main orchestration                                                 */
/* ------------------------------------------------------------------ */

async function main() {
  const opts = parseArgs();
  const projectDir = resolveProject(opts.projectDir);

  console.log(`\n  /understand-mock — ${projectDir}\n`);

  // Detect monorepo mode
  const targets = detectApps(projectDir);
  const isMonorepo = targets.length > 1 && targets[0] !== projectDir;

  if (isMonorepo) {
    console.log(`Detected ${targets.length} monorepo apps`);
  }

  for (const target of targets) {
    const appLabel = isMonorepo ? ` [${path.relative(projectDir, target)}]` : "";
    const runOptions = { ...opts };

    if (opts.pagesOnly) {
      // Only run page-detector
      const pagesResult = phase1(target, runOptions);
      if (pagesResult.pages.length === 0) {
        console.error(`✗ No pages detected in ${target}`);
        process.exit(1);
      }
      console.log(`\n📄 pages.json summary (${pagesResult.pages.length} pages):`);
      for (const p of pagesResult.pages.slice(0, 10)) {
        console.log(`  ${p.id}: ${p.route} (${p.kind}, ${p.mockStrategy})`);
      }
      if (pagesResult.pages.length > 10) {
        console.log(`  ... and ${pagesResult.pages.length - 10} more`);
      }
      continue;
    }

    // Full pipeline
    const pagesResult = phase1(target, runOptions);
    if (pagesResult.pages.length === 0) {
      console.error(`✗ No pages detected in ${target}`);
      process.exit(1);
    }

    phase2(target, runOptions);
    crossRefApiCalls(target);
    phase3(target, runOptions);
    phase4(target, runOptions);
  }

  // Only start the server if running on a single target
  if (!isMonorepo) {
    phase5(projectDir, opts);
  }
}

main().catch((err) => {
  console.error("Pipeline error:", err.message);
  process.exit(1);
});
