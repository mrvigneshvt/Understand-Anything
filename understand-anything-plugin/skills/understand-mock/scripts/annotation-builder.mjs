#!/usr/bin/env node
/**
 * annotation-builder.mjs — call-chain tree per page with real file:line.
 *
 * Phase 1 (deterministic): KG-edge walk from page node through imports/calls.
 * Phase 2 (LLM, optional): supplement edges when depth < 4.
 *
 * Usage:
 *   node annotation-builder.mjs [projectDir] [--no-llm] [--output-dir <dir>]
 */

import fs from "node:fs";
import path from "node:path";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

/**
 * @typedef {"ui"|"hook"|"store"|"fetch"|"server"|"service"|"model"|"type"|"controller"} NodeKind
 * @typedef {{ id: string; label: string; kind: NodeKind; file: string;
 *   line: number; snippet?: string; children?: AnnotationNode[];
 *   uiBindings?: string[]; }} AnnotationNode
 * @typedef {{ pageId: string; pageName: string; pageRoute: string;
 *   nodes: AnnotationNode[]; uiBindings?: string[]; }} PageAnnotation
 */

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function exists(filePath) {
  try { return fs.statSync(filePath).isFile(); } catch { return false; }
}

function readFile(filePath) {
  try { return fs.readFileSync(filePath, "utf-8"); } catch { return ""; }
}

function slugify(str) {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").substring(0, 80) || "node";
}

function countLines(filePath) {
  const content = readFile(filePath);
  return content.split("\n").length;
}

/** Resolve an import specifier to an absolute path */
function resolveImport(specifier, importerDir, projectDir) {
  let clean = specifier.replace(/^type\s+/, "").replace(/\s+with\s+.*$/, "").replace(/\s+assert\s+.*$/, "").trim();

  // @/ alias
  if (clean.startsWith("@/")) {
    clean = clean.slice(2);
    const candidates = [
      path.join(projectDir, clean), path.join(projectDir, clean + ".ts"),
      path.join(projectDir, clean + ".tsx"), path.join(projectDir, clean + ".js"),
      path.join(projectDir, clean + ".mjs"), path.join(projectDir, clean, "index.ts"),
      path.join(projectDir, clean, "index.tsx"), path.join(projectDir, clean, "index.js"),
      path.join(projectDir, clean, "index.mjs"),
    ];
    for (const c of candidates) { if (exists(c)) return c; }
    return null;
  }

  if (!clean.startsWith(".") && !clean.startsWith("/")) return null;

  if (clean.startsWith("/")) {
    const candidates = [clean, clean + ".ts", clean + ".tsx",
      path.join(clean, "index.ts"), path.join(clean, "index.tsx"),
      clean + ".js", clean + ".mjs"];
    for (const c of candidates) {
      const full = path.resolve(projectDir, c.slice(1));
      if (exists(full)) return full;
    }
    return null;
  }

  const resolved = path.resolve(importerDir, clean);
  const candidates = [
    resolved, resolved + ".ts", resolved + ".tsx", resolved + ".js", resolved + ".mjs",
    path.join(resolved, "index.ts"), path.join(resolved, "index.tsx"),
    path.join(resolved, "index.js"), path.join(resolved, "index.mjs"),
  ];
  for (const c of candidates) { if (exists(c)) return c; }
  return null;
}

/** Classify a file's role based on its path and content */
function classifyNode(fileRel, content, projectDir) {
  /** @type {NodeKind} */
  let kind = "ui";
  const lower = fileRel.toLowerCase();

  // Page files (app/**/page.tsx) are always ui
  if (/\bpage\.(?:tsx|ts)$/.test(fileRel) && (lower.startsWith("app") || lower.startsWith("pages"))) {
    return "ui";
  }

  if (lower.includes("store") || lower.includes("state")) kind = "store";
  else if (lower.includes("hook") || lower.includes("use") && !lower.includes("user")) kind = "hook";
  else if (lower.includes("service") || lower.includes("services")) kind = "service";
  else if (lower.includes("model") || lower.includes("models")) kind = "model";
  else if (lower.includes("type") || lower.includes("types") || lower.includes("schema")) kind = "type";
  else if (lower.includes("api/") || lower.includes("route.") || lower.includes("controller")) kind = "controller";
  else if (content.includes("fetch(") || content.includes("axios.") || content.includes("apiGet(") || content.includes("apiPost(")) kind = fetchCall(content);
  else if (content.includes('"use server"') || content.includes("'use server'")) kind = "server";

  // Heuristics based on content
  if (kind === "ui") {
    if (content.includes("useEffect") || content.includes("useState")) {
      // Check if it's a hook file
      if (!lower.includes("component") && !lower.includes("page")) kind = "hook";
    }
    if (content.includes("create(") && content.includes("zustand")) kind = "store";
  }

  return kind;
}

function fetchCall(content) {
  if (content.includes("fetch(") || content.includes("axios.") || content.includes("apiGet(") || content.includes("apiPost(") || content.includes("apiPut(") || content.includes("apiDelete(")) {
    return "fetch";
  }
  return "ui";
}

/** Find the best line for a node (export or function definition) */
function findNodeLine(content) {
  const patterns = [
    /import\s+(?:type\s+)?(?:\{[^}]*\}\s+from|\w+\s+from)/,  // import statements (earliest)
    /export (default )?(function|const|class|interface|type) \w+/,
    /^(function|const|class) \w+/,
    /export \{/,
  ];
  const lines = content.split("\n");
  for (const pattern of patterns) {
    const match = pattern.exec(content);
    if (match) {
      return content.slice(0, match.index).split("\n").length;
    }
  }
  return 1;
}

/** Parse imports from file content */
function parseImports(content) {
  const imports = [];
  const regex = /import\s+(?:type\s+)?(?:\{[^}]*\}\s+from\s+)?(?:\*\s+as\s+\w+\s+from\s+)?(?:\w+\s+from\s+)?['"`]([^'"`]+)['"`]/g;
  let m;
  while ((m = regex.exec(content)) !== null) imports.push(m[1]);
  return imports;
}

/** Extract uiBindings from mock data file — returns CSS selector strings per §8.3 */
function extractUIBindings(pageId, projectDir) {
  const mockDirs = [
    path.join(projectDir, ".ua", "mock-guide", "mocks", `${pageId}.tsx`),
    path.join(projectDir, ".ua", "mock-guide", "mocks", `${pageId}.json`),
    path.join(projectDir, "mocks", `${pageId}.tsx`),
    path.join(projectDir, "mocks", `${pageId}.json`),
  ];

  for (const mockPath of mockDirs) {
    if (!exists(mockPath)) continue;
    const content = readFile(mockPath);
    const bindingPattern = /data-ua-binding=["']([^"']+)["']/g;
    const bindings = [];
    let m;
    while ((m = bindingPattern.exec(content)) !== null) {
      bindings.push(m[1]);
    }
    return bindings;
  }
  return [];
}

/* ------------------------------------------------------------------ */
/*  Main builder                                                       */
/* ------------------------------------------------------------------ */

/**
 * @param {string} projectDir
 * @param {{ noLlm?: boolean }} options
 * @returns {PageAnnotation[]}
 */
export function buildAnnotations(projectDir, options = {}) {
  const pagesPath = path.join(projectDir, ".ua", "mock-guide", "pages.json");
  const apiMapPath = path.join(projectDir, ".ua", "mock-guide", "api-map.json");

  /** @type {PageAnnotation[]} */
  const annotations = [];

  /** @type {import('./page-detector.mjs').PageDetection} */
  let pagesJson;
  try { pagesJson = JSON.parse(readFile(pagesPath)); } catch { return []; }

  /** @type {import('./api-mapper.mjs').ApiMap} */
  let apiMap;
  try { apiMap = JSON.parse(readFile(apiMapPath)); } catch { apiMap = {}; }

  const pages = pagesJson.pages || [];
  // api-map is now Record<pageId, {calls, schemas}> per §8.2
  const callsByPage = {};
  for (const pageId of Object.keys(apiMap)) {
    callsByPage[pageId] = apiMap[pageId].calls || [];
  }

  for (const page of pages) {
    const visited = new Set();
    /** @type {AnnotationNode[]} */
    const nodes = [];

    /** Walk imports from a file and build nodes */
    function walk(fileRel, depth) {
      if (depth > 5) return null;
      const absPath = path.resolve(projectDir, fileRel);
      if (!exists(absPath)) return null;
      if (visited.has(absPath)) return null;
      visited.add(absPath);

      const content = readFile(absPath);
      const kind = classifyNode(fileRel, content);
      const line = findNodeLine(content);
      const label = path.basename(fileRel, path.extname(fileRel));

      // Extract snippet: 3 lines around the node line
      const allLines = content.split("\n");
      const snippetStart = Math.max(0, line - 2);
      const snippetEnd = Math.min(allLines.length, line + 1);
      const snippet = allLines.slice(snippetStart, snippetEnd).join("\n");

      /** @type {AnnotationNode} */
      const node = {
        id: `${page.id}-${slugify(fileRel.replace(/\\/g, "/").replace(/\.(ts|tsx|js|mjs)$/, ""))}-${depth}`,
        label,
        kind,
        file: fileRel.replace(/\\/g, "/"),
        line,
        snippet,
      };

      const children = [];
      const imports = parseImports(content);

      // Also add API calls from api-map as child nodes
      const pageCalls = callsByPage[page.id] || [];
      for (const call of pageCalls) {
        if (call.file === fileRel) {
          const callAbsPath = path.resolve(projectDir, call.file);
          const callLines = exists(callAbsPath) ? readFile(callAbsPath).split("\n") : [];
          const callSnippetStart = Math.max(0, call.line - 2);
          const callSnippetEnd = Math.min(callLines.length, call.line + 1);
          const callSnippet = callLines.slice(callSnippetStart, callSnippetEnd).join("\n");

          children.push({
            id: `${page.id}-api-${slugify(call.method + "-" + call.endpoint)}-${call.line}`,
            label: `${call.method} ${call.endpoint}`,
            kind: "fetch",
            file: call.file,
            line: call.line,
            snippet: callSnippet,
          });
        }
      }

      // Recurse into imports
      for (const specifier of imports) {
        const resolved = resolveImport(specifier, path.dirname(absPath), projectDir);
        if (resolved) {
          const childRel = path.relative(projectDir, resolved).replace(/\\/g, "/");
          const child = walk(childRel, depth + 1);
          if (child) children.push(child);
        }
      }

      if (children.length > 0) node.children = children;
      return node;
    }

    const root = walk(page.file, 0);
    if (root) {
      const uiBindings = extractUIBindings(page.id, projectDir);
      annotations.push({
        pageId: page.id,
        pageName: page.title,
        pageRoute: page.route,
        nodes: root.children ? [root, ...root.children] : [root],
        uiBindings: uiBindings.length > 0 ? uiBindings : undefined,
      });
    }
  }

  return annotations;
}

/* ------------------------------------------------------------------ */
/*  CLI entry point                                                    */
/* ------------------------------------------------------------------ */

function main() {
  const args = process.argv.slice(2);
  let projectDir = process.cwd();
  let outputDir = null;
  let noLlm = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--no-llm") noLlm = true;
    else if (args[i] === "--output-dir" && i + 1 < args.length) outputDir = args[++i];
    else if (!args[i].startsWith("--")) projectDir = path.resolve(args[i]);
  }

  if (!fs.existsSync(projectDir)) {
    console.error(`Error: directory not found: ${projectDir}`);
    process.exit(1);
  }

  const result = buildAnnotations(projectDir, { noLlm });

  const baseDir = outputDir || path.join(projectDir, ".ua", "mock-guide", "annotations");
  fs.mkdirSync(baseDir, { recursive: true });

  let totalNodes = 0;
  for (const ann of result) {
    const outPath = path.join(baseDir, `${ann.pageId}.json`);
    fs.writeFileSync(outPath, JSON.stringify(ann, null, 2), "utf-8");
    totalNodes += ann.nodes.length;
  }

  console.log(`Built ${result.length} annotation files with ${totalNodes} nodes`);
}

if (process.argv[1] && (process.argv[1].endsWith("annotation-builder.mjs") || process.argv[1].endsWith("annotation-builder"))) {
  main();
}
