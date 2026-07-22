#!/usr/bin/env node
/**
 * screenshot.mjs — Playwright headless capture mode for mock-generator.
 *
 * Two adapters (structured for upgrade):
 *   1. MCP Playwright server (current, POC) — use via screenshotViaMCP()
 *   2. Direct Playwright (portable, prod) — swap import + uncomment playwright
 *      adapter. Install: pnpm add -D playwright && npx playwright install chromium
 *
 * Usage:
 *   node screenshot.mjs [projectDir] [--mode mcp|direct] [--no-llm]
 *
 * ponytail: MCP adapter — replace the adapter function body with direct
 *   `import { chromium } from 'playwright'` for standalone portability.
 *   The MCP server is already connected in this environment.
 */

import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";

/* ------------------------------------------------------------------ */
/*  Config                                                             */
/* ------------------------------------------------------------------ */

const MAX_PNG_BYTES = 500 * 1024; // 500 KB
const VIEWPORT = { width: 1280, height: 800 };
const DEV_TIMEOUT_MS = 30_000;

/* ------------------------------------------------------------------ */
/*  helpers                                                            */
/* ------------------------------------------------------------------ */

function exists(filePath) {
  try { return fs.statSync(filePath).isFile(); } catch { return false; }
}

function readFile(filePath) {
  try { return fs.readFileSync(filePath, "utf-8"); } catch { return ""; }
}

function slugify(str) {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").substring(0, 60);
}

/* ------------------------------------------------------------------ */
/*  Adapter: MCP Playwright server (POC)                              */
/* ------------------------------------------------------------------ */

/**
 * Screenshot via the Playwright MCP server.
 * The executor drives browser_navigate + browser_screenshot MCP tools.
 * This function logs the commands for the executor to run.
 *
 * Returns: [{ pageId, command, pngPath }] — the executor picks these up.
 *
 * ponytail: Replace the body with `import { chromium } from 'playwright'`
 *   and direct browser.newPage() / page.screenshot() calls.
 */
function planScreenshotsViaMCP(projectDir, pages, outputDir) {
  const baseUrl = detectBaseUrl(projectDir);
  if (!baseUrl) {
    console.warn("Could not detect base URL — falling back to structural mode");
    return null;
  }

  const commands = [];
  for (const page of pages) {
    if (!page.route) continue;
    const pngPath = path.join(outputDir, `${page.id}.png`);
    commands.push({
      pageId: page.id,
      name: page.name,
      route: page.route,
      url: `${baseUrl}${page.route}`,
      pngPath,
      steps: [
        { action: "navigate", url: `${baseUrl}${page.route}` },
        { action: "wait", condition: "networkidle" },
        { action: "screenshot", path: pngPath },
      ],
    });
  }
  return commands;
}

function detectBaseUrl(projectDir) {
  // Check if there's a known dev server pattern
  const pkgPath = path.join(projectDir, "package.json");
  if (exists(pkgPath)) {
    try {
      const pkg = JSON.parse(readFile(pkgPath));
      if (pkg.scripts?.dev) {
        // Common default ports
        if (pkg.dependencies?.next || pkg.devDependencies?.next) return "http://127.0.0.1:3000";
        if (pkg.devDependencies?.vite) return "http://127.0.0.1:5173";
      }
    } catch {}
  }
  return null;
}

/* ------------------------------------------------------------------ */
/*  Main screenshot orchestrator                                      */
/* ------------------------------------------------------------------ */

/**
 * @param {string} projectDir
 * @param {{ noLlm?: boolean; mode?: 'mcp'|'direct' }} options
 * @returns {{ screenshots: number; fallback: boolean }}
 */
export function captureScreenshots(projectDir, options = {}) {
  const pagesPath = path.join(projectDir, ".ua", "mock-guide", "pages.json");
  let pagesJson;
  try { pagesJson = JSON.parse(readFile(pagesPath)); } catch { return { screenshots: 0, fallback: true }; }

  const pages = pagesJson.pages || [];
  const outputDir = path.join(projectDir, ".ua", "mock-guide", "public", "screenshots");
  fs.mkdirSync(outputDir, { recursive: true });

  // MCP driver path
  if (!options.mode || options.mode === "mcp") {
    const commands = planScreenshotsViaMCP(projectDir, pages, outputDir);
    if (!commands) {
      console.log("MCP adapter returned no commands — falling back to structural mode");
      return { screenshots: 0, fallback: true };
    }

    // Write the command manifest for the executor to process
    const manifestPath = path.join(outputDir, "..", "screenshot-commands.json");
    fs.writeFileSync(manifestPath, JSON.stringify(commands, null, 2), "utf-8");
    console.log(`Planned ${commands.length} screenshots for MCP execution`);
    console.log(`Commands manifest: ${manifestPath}`);
    console.log("Executor: run each command's steps using the Playwright MCP tools:");
    for (const cmd of commands) {
      console.log(`  ${cmd.pageId}: ${cmd.url}`);
      console.log(`    → mcp({ tool: "browser_navigate", args: '{"url": "${cmd.url}"}' })`);
      console.log(`    → mcp({ tool: "browser_screenshot", args: '{"path": "${cmd.pngPath}"}' })`);
    }

    return { screenshots: commands.length, fallback: false };
  }

  // Direct Playwright path (stub for future)
  console.log("Direct Playwright mode not yet implemented. See ponytail: comment.");
  return { screenshots: 0, fallback: true };
}

/* ------------------------------------------------------------------ */
/*  CLI entry point                                                    */
/* ------------------------------------------------------------------ */

function main() {
  const args = process.argv.slice(2);
  let projectDir = process.cwd();
  let mode = "mcp";

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--mode" && i + 1 < args.length) mode = args[++i];
    else if (!args[i].startsWith("--")) projectDir = path.resolve(args[i]);
  }

  if (!fs.existsSync(projectDir)) {
    console.error(`Error: directory not found: ${projectDir}`);
    process.exit(1);
  }

  const result = captureScreenshots(projectDir, { mode });
  if (result.fallback) {
    console.log("Screenshot mode unavailable — falling back to structural mode (C4)");
  }
}

if (process.argv[1] && process.argv[1].endsWith("screenshot.mjs")) {
  main();
}
