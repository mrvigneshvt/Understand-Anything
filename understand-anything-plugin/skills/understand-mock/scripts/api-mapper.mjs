#!/usr/bin/env node
/**
 * api-mapper.mjs — per-page API call trace with schema extraction.
 *
 * Phase 1 (deterministic): static import walk + regex API detection + schema extraction.
 * Phase 2 (LLM, optional): fallback for schema inference when static fails.
 *
 * Usage:
 *   node api-mapper.mjs [projectDir] [--no-llm] [--output <path>] [--pages <pages.json>]
 */

import fs from "node:fs";
import path from "node:path";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

/**
 * @typedef {"GET"|"POST"|"PUT"|"DELETE"|"PATCH"|"RPC"|"INTERNAL"} HttpMethod
 * @typedef {"type"|"zod"|"pydantic"|"graphql"|"interface"|"class"} SchemaKind
 *
 * @typedef {{ name: string; type: string; optional: boolean; }} SchemaField
 * @typedef {{ name: string; file: string; line: number;
 *   kind: SchemaKind;
 *   fields: SchemaField[]; }} SchemaRef
 *
 * @typedef {{ id: string; file: string; line: number;
 *   method: HttpMethod; endpoint: string;
 *   requestSchema?: string; responseSchema?: string;
 *   authRequired: boolean; }} ApiCall
 *
 * @typedef {Record<string, { calls: ApiCall[]; schemas: SchemaRef[] }>} ApiMap
 */

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

const RESOURCE_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"]);

function exists(filePath) {
  try {
    return fs.statSync(filePath).isFile();
  } catch {
    return false;
  }
}

function readFile(filePath) {
  try {
    return fs.readFileSync(filePath, "utf-8");
  } catch {
    return "";
  }
}

function readLines(filePath) {
  const content = readFile(filePath);
  return content.split("\n");
}

/**
 * Resolve a module specifier to an absolute file path.
 * Handles relative imports (./ ../) and bare specifiers (lib/api).
 * Does NOT resolve bare package names (react, lodash) — returns null.
 */
function resolveImport(specifier, importerDir, projectDir) {
  // Remove type-only assertions and keep the specifier clean
  let clean = specifier.replace(/^type\s+/, "").replace(/\s+with\s+.*$/, "").replace(/\s+assert\s+.*$/, "").trim();

  // Handle @/ path alias (maps to project root)
  if (clean.startsWith("@/")) {
    clean = clean.slice(2);
    const candidates = [
      path.join(projectDir, clean),
      path.join(projectDir, clean + ".ts"),
      path.join(projectDir, clean + ".tsx"),
      path.join(projectDir, clean + ".js"),
      path.join(projectDir, clean + ".mjs"),
      path.join(projectDir, clean, "index.ts"),
      path.join(projectDir, clean, "index.tsx"),
      path.join(projectDir, clean, "index.js"),
      path.join(projectDir, clean, "index.mjs"),
    ];
    for (const c of candidates) {
      if (exists(c)) return c;
    }
    return null;
  }

  // Bare specifiers (package names) — skip, they're in node_modules
  if (!clean.startsWith(".") && !clean.startsWith("/")) return null;

  if (clean.startsWith("/")) {
    // Absolute within project
    const candidates = [clean, clean + ".ts", clean + ".tsx", clean + "/index.ts", clean + "/index.tsx", clean + ".js", clean + "/index.js", clean + ".mjs"];
    for (const c of candidates) {
      const full = path.resolve(projectDir, c.slice(1));
      if (exists(full)) return full;
    }
    return null;
  }

  const resolved = path.resolve(importerDir, clean);

  // Try exact, then with extensions, then index files
  const candidates = [
    resolved,
    resolved + ".ts",
    resolved + ".tsx",
    resolved + ".js",
    resolved + ".mjs",
    path.join(resolved, "index.ts"),
    path.join(resolved, "index.tsx"),
    path.join(resolved, "index.js"),
    path.join(resolved, "index.mjs"),
  ];
  for (const c of candidates) {
    if (exists(c)) return c;
  }
  return null;
}

/** Parse import statements from file content */
function parseImports(content, filePath) {
  const imports = [];
  // import X from '...' — default import
  // import { X } from '...' — named import
  // import '...' — side-effect import
  // import type { X } from '...'
  const importRegex = /import\s+(?:type\s+)?(?:\{[^}]*\}\s+from\s+)?(?:\*\s+as\s+\w+\s+from\s+)?(?:\w+\s+from\s+)?['"`]([^'"`]+)['"`]/g;
  // Also dynamic import() calls
  const dynamicRegex = /import\(['"`]([^'"`]+)['"`]\)/g;
  // Also require() calls
  const requireRegex = /require\(['"`]([^'"`]+)['"`]\)/g;

  let match;
  while ((match = importRegex.exec(content)) !== null) {
    imports.push(match[1]);
  }
  while ((match = dynamicRegex.exec(content)) !== null) {
    imports.push(match[1]);
  }
  while ((match = requireRegex.exec(content)) !== null) {
    imports.push(match[1]);
  }
  return imports;
}

/** Detect API calls in file content. Returns array of { method, path, line } */
function detectApiCalls(content, lines) {
  /** @type {{ method: HttpMethod; path: string; line: number }[]} */
  const calls = [];

  // fetch("...") or fetch('...') or fetch(`...`)
  const fetchRegex = /fetch\(['"`]([^'"`]+)['"`]/g;
  let match;
  while ((match = fetchRegex.exec(content)) !== null) {
    const lineNum = content.slice(0, match.index).split("\n").length;
    calls.push({ method: "GET", path: match[1], line: lineNum });
  }

  // axios.get/post/put/delete/patch('...')
  const axiosRegex = /axios\.(get|post|put|delete|patch)\(['"`]([^'"`]+)['"`]/g;
  while ((match = axiosRegex.exec(content)) !== null) {
    const lineNum = content.slice(0, match.index).split("\n").length;
    calls.push({ method: match[1].toUpperCase(), path: match[2], line: lineNum });
  }

  // apiGet/apiPost/apiPut/apiDelete<T>('...') — typed wrappers with optional generics
  const apiHelperRegex = /(apiGet|apiPost|apiPut|apiDelete)(?:<[^>]*>)?\(['"`]([^'"`]+)['"`]/g;
  while ((match = apiHelperRegex.exec(content)) !== null) {
    const methodMap = { apiGet: "GET", apiPost: "POST", apiPut: "PUT", apiDelete: "DELETE" };
    const lineNum = content.slice(0, match.index).split("\n").length;
    // Skip template-literal paths (${...}) — they're dynamic, not concrete endpoints
    if (match[2].includes("${")) continue;
    calls.push({ method: methodMap[match[1]] || "GET", path: match[2], line: lineNum });
  }

  // GraphQL tagged template: gql`...`
  const gqlRegex = /gql`/g;
  while ((match = gqlRegex.exec(content)) !== null) {
    const lineNum = content.slice(0, match.index).split("\n").length;
    calls.push({ method: "POST", path: "/graphql", line: lineNum });
  }

  // Next.js Server Actions: 'use server' + exported async functions
  // RPC patterns: .call(, .invoke(, .query(, .mutate(
  const rpcRegex = /\.(call|invoke|query|mutate)\(['"`]([^'"`]+)['"`]/g;
  while ((match = rpcRegex.exec(content)) !== null) {
    const lineNum = content.slice(0, match.index).split("\n").length;
    calls.push({ method: "POST", path: match[2], line: lineNum });
  }

  // httpx python patterns
  const httpxRegex = /httpx\.(get|post|put|delete|patch)\(['"`]([^'"`]+)['"`]/g;
  while ((match = httpxRegex.exec(content)) !== null) {
    const lineNum = content.slice(0, match.index).split("\n").length;
    calls.push({ method: match[1].toUpperCase(), path: match[2], line: lineNum });
  }

  return calls;
}

/** Extract fields from a Zod schema definition */
function extractZodFields(content, schemaName) {
  // Find `z.object({ ... })` or `z.object({...}).extend(...)` and extract fields
  const objPattern = new RegExp(
    schemaName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") +
    "\\s*=\\s*z\\.object\\(\\{\\n?([^}]+)\\n?\\)",
    "s"
  );
  const match = content.match(objPattern);
  if (!match) return [];

  const fields = [];
  // Parse each field: fieldName: z.type().optional()?, or fieldName: z.type()
  const fieldPattern = /(\w+)\s*:\s*z\s*\.\s*(\w+(?:\(\))?)(?:\s*\.\s*optional\(\))?/g;
  let f;
  while ((f = fieldPattern.exec(match[1])) !== null) {
    fields.push({
      name: f[1],
      type: f[2].replace(/\(\)$/, ""),
      optional: match[1].slice(f.index).startsWith(f[0]) &&
        match[1].slice(f.index + f[0].length).startsWith(".optional()"),
    });
  }
  // Better optional check: re-scan with .optional() included
  const fieldPattern2 = /(\w+)\s*:\s*z\s*\.\s*(\w+(?:\(\))?(?:\s*\.\s*optional\(\))?)/g;
  fields.length = 0;
  while ((f = fieldPattern2.exec(match[1])) !== null) {
    fields.push({
      name: f[1],
      type: f[2].replace(/\(\)/g, ""),
      optional: f[2].includes("optional"),
    });
  }
  return fields;
}

/** Extract fields from a TypeScript interface/type definition */
function extractTSFields(content, typeName) {
  // Find `interface Xxx { ... }` or `type Xxx = { ... }`
  const ifacePattern = new RegExp(
    "(?:interface|type)\\s+" +
    typeName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") +
    "(?:\\s*=\\s*)?\\{\\n?([^}]+)\
?\\)?",
    "s"
  );
  const match = content.match(ifacePattern);
  if (!match) return [];

  const fields = [];
  // Parse each field: fieldName?: Type, fieldName: Type
  const fieldPattern = /(\w+)(\?)?\s*:\s*([^;\n]+)/g;
  let f;
  while ((f = fieldPattern.exec(match[1])) !== null) {
    fields.push({
      name: f[1],
      type: f[3].trim(),
      optional: !!f[2],
    });
  }
  return fields;
}

/** Try to extract schemas for a given API call */
function extractSchema(filePath, content, lines, callPath) {
  /** @type {SchemaRef | undefined} */
  let requestSchema;
  /** @type {SchemaRef | undefined} */
  let responseSchema;
  const collectedSchemas = [];

  // Look for Zod schemas: export const XxxSchema = z.object({...})
  const zodPattern = /(?:export\s+)?(?:const|let|var)\s+(\w+Schema)\s*=\s*z\./g;
  let m;
  while ((m = zodPattern.exec(content)) !== null) {
    const lineNum = content.slice(0, m.index).split("\n").length;
    const fields = extractZodFields(content, m[1]);
    const ref = { name: m[1], file: filePath, line: lineNum, kind: "zod", fields };
    collectedSchemas.push(ref);
    // Match schema name to call path
    const pathPart = callPath.split("/").pop() || callPath;
    if (m[1].toLowerCase().includes(pathPart.toLowerCase())) {
      if (!responseSchema) responseSchema = m[1];
      else if (!requestSchema) requestSchema = m[1];
    }
  }

  // Look for TS interfaces: export interface Xxx { ... }
  const tsInterfacePattern = /export\s+(interface|type)\s+(\w+)/g;
  while ((m = tsInterfacePattern.exec(content)) !== null) {
    const lineNum = content.slice(0, m.index).split("\n").length;
    const fields = extractTSFields(content, m[2]);
    const ref = { name: m[2], file: filePath, line: lineNum, kind: m[1] === "interface" ? "interface" : "type", fields };
    collectedSchemas.push(ref);
    const pathPart = callPath.split("/").pop() || callPath;
    if (m[2].toLowerCase().includes(pathPart.toLowerCase())) {
      if (!responseSchema) responseSchema = m[2];
      else if (!requestSchema) requestSchema = m[2];
    }
  }

  return { requestSchema, responseSchema, collectedSchemas };
}

/* ------------------------------------------------------------------ */
/*  Main mapper                                                        */
/* ------------------------------------------------------------------ */

/**
 * @param {string} projectDir
 * @param {{ noLlm?: boolean; pagesPath?: string }} options
 * @returns {ApiMap}
 */
export function mapApiCalls(projectDir, options = {}) {
  const pagesPath = options.pagesPath || path.join(projectDir, ".ua", "mock-guide", "pages.json");

  if (!exists(pagesPath)) {
    console.warn("Warning: pages.json not found at", pagesPath);
    return {};
  }

  let pagesJson;
  try {
    pagesJson = JSON.parse(fs.readFileSync(pagesPath, "utf-8"));
  } catch {
    console.warn("Warning: failed to parse pages.json");
    return {};
  }

  const pages = pagesJson.pages || [];
  /** @type {ApiMap} */
  const perPage = {};
  /** Schemas collected per page, deduplicated by key */
  const perPageSchemas = {};

  /** Walk imports up to maxDepth hops from a file */
  function walkImports(filePath, currentDepth, pageId, visited) {
    if (currentDepth > 2) return;
    if (visited.has(filePath)) return;
    visited.add(filePath);

    const absPath = path.resolve(projectDir, filePath);
    if (!exists(absPath)) return;

    const content = readFile(absPath);

    // Detect API calls in this file
    const calls = detectApiCalls(content, content.split("\n"));
    for (const call of calls) {
      const fileRel = path.relative(projectDir, absPath).replace(/\\/g, "/");

      // Deduplicate by (file, line, method)
      const existing = perPage[pageId]?.calls.find(
        (c) => c.file === fileRel && c.line === call.line && c.method === call.method
      );
      if (existing) continue;

      const callId = slugify(`${pageId}-${call.method}-${call.path}-${fileRel}-${call.line}`);

      // Try to extract schemas (pass relative path for SchemaRef.file)
      const schemas = extractSchema(fileRel, content, content.split("\n"), call.path);

      // Build per-page schema index
      if (!perPageSchemas[pageId]) perPageSchemas[pageId] = new Map();
      for (const s of schemas.collectedSchemas) {
        const key = `${s.name}:${s.file}:${s.line}`;
        if (!perPageSchemas[pageId].has(key)) {
          perPageSchemas[pageId].set(key, s);
        }
      }

      if (!perPage[pageId]) perPage[pageId] = { calls: [], schemas: [] };
      perPage[pageId].calls.push({
        id: callId,
        method: call.method,
        endpoint: call.path,
        file: fileRel,
        line: call.line,
        authRequired: call.path.startsWith("/api/") || call.path.startsWith("/auth/") || !call.path.startsWith("/"),
        requestSchema: schemas.requestSchema,
        responseSchema: schemas.responseSchema,
      });
    }

    // Find imports and recurse
    const imports = parseImports(content, absPath);
    for (const specifier of imports) {
      const resolved = resolveImport(specifier, path.dirname(absPath), projectDir);
      if (resolved) {
        const rel = path.relative(projectDir, resolved).replace(/\\/g, "/");
        if (!visited.has(resolved)) {
          walkImports(rel, currentDepth + 1, pageId, visited);
        }
      }
    }
  }

  // Walk each page with its own visited set
  for (const page of pages) {
    if (page.file) {
      const visited = new Set();
      walkImports(page.file, 0, page.id, visited);
    }
  }

  // Ensure every page has an entry (even if zero calls/schemas)
  for (const page of pages) {
    if (!perPage[page.id]) {
      perPage[page.id] = { calls: [], schemas: [] };
    } else if (perPageSchemas[page.id]) {
      perPage[page.id].schemas = Array.from(perPageSchemas[page.id].values());
    }
  }

  return perPage;
}

function slugify(str) {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .substring(0, 100) || "call";
}

/* ------------------------------------------------------------------ */
/*  CLI entry point                                                    */
/* ------------------------------------------------------------------ */

function main() {
  const args = process.argv.slice(2);
  let projectDir = process.cwd();
  let outputPath = null;
  let pagesPath = null;
  let noLlm = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--no-llm") {
      noLlm = true;
    } else if (args[i] === "--output" && i + 1 < args.length) {
      outputPath = args[++i];
    } else if (args[i] === "--pages" && i + 1 < args.length) {
      pagesPath = args[++i];
    } else if (!args[i].startsWith("--")) {
      projectDir = path.resolve(args[i]);
    }
  }

  if (!fs.existsSync(projectDir)) {
    console.error(`Error: directory not found: ${projectDir}`);
    process.exit(1);
  }

  const result = mapApiCalls(projectDir, { noLlm, pagesPath });

  const outPath = outputPath || path.join(projectDir, ".ua", "mock-guide", "api-map.json");
  const outDir = path.dirname(outPath);
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(result, null, 2), "utf-8");

  let totalCalls = 0;
  for (const pageId of Object.keys(result)) {
    totalCalls += result[pageId].calls.length;
  }
  console.log(`Mapped ${totalCalls} API calls across ${Object.keys(result).length} pages`);
}

if (process.argv[1] && (process.argv[1].endsWith("api-mapper.mjs") || process.argv[1].endsWith("api-mapper"))) {
  main();
}
