#!/usr/bin/env node
/**
 * page-detector.mjs — two-phase page inventory for any project.
 *
 * Phase 1 (deterministic): glob/regex-based framework detection.
 * Phase 2 (LLM, optional): fallback for unknown frameworks.
 *
 * Usage:
 *   node page-detector.mjs [projectDir] [--no-llm] [--output <path>]
 *
 * Output: .ua/mock-guide/pages.json or --output path.
 */

import fs from "node:fs";
import path from "node:path";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

/**
 * @typedef {"screenshot" | "structural" | "template"} MockStrategy
 * @typedef {"page" | "endpoint" | "command" | "export" | "screen"} PageKind
 *
 * @typedef {{ id: string; title: string; route: string; file: string;
 *   lineRange?: [number, number]; kind: PageKind;
 *   mockFile: string; seedFile: string; annotationFile: string;
 *   mockStrategy: MockStrategy; framework: string;
 *   components: string[]; apiCalls: string[]; personas: string[]; }} Page
 *
 * @typedef {{ framework: string; pages: Page[]; }} PageDetection
 */

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function slugify(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "unnamed";
}

function exists(filePath) {
  try {
    return fs.statSync(filePath).isFile();
  } catch {
    return false;
  }
}

function glob(pattern, root) {
  const results = [];
  const full = path.resolve(root, pattern);
  const dir = path.dirname(full);
  const base = path.basename(full);
  if (!fs.existsSync(dir)) return results;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith(".")) continue;
    if (entry.isDirectory()) {
      // recurse
      const subResults = glob(
        path.join(pattern.split("*")[0], entry.name, "**", base),
        root
      );
      results.push(...subResults);
    } else if (entry.isFile()) {
      const rel = path.relative(root, path.join(dir, entry.name));
      if (rel) results.push(rel);
    }
  }
  return results;
}

/** Recursively find files matching a name or extension */
function findFiles(root, match, excludeDirs = []) {
  const results = [];
  const skip = new Set(["node_modules", ".git", ".next", ...excludeDirs]);
  function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (skip.has(entry.name)) continue;
      if (entry.name.startsWith(".")) continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (entry.isFile()) {
        if (match.startsWith(".")) {
          // match by extension
          if (entry.name.endsWith(match)) results.push(full);
        } else {
          // match by exact filename
          if (entry.name === match) results.push(full);
        }
      }
    }
  }
  walk(root);
  return results;
}

function readFileLines(filePath) {
  try {
    return fs.readFileSync(filePath, "utf-8").split("\n");
  } catch {
    return [];
  }
}

/* ------------------------------------------------------------------ */
/*  Detection strategies                                               */
/* ------------------------------------------------------------------ */

/** 1 & 2: Next.js App Router + Pages Router */
function detectNextJS(projectDir) {
  /** @type {Page[]} */
  const pages = [];
  const appDir = path.join(projectDir, "app");
  const pagesDir = path.join(projectDir, "pages");

  // App Router pages
  if (fs.existsSync(appDir)) {
    // Recursive walk for page.tsx/page.tsx files under app/ (but skip api/)
    const pageFiles = [];
    function walk(dir, relBase) {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (entry.name.startsWith(".") || entry.name === "node_modules") continue;
        const full = path.join(dir, entry.name);
        const rel = relBase ? path.join(relBase, entry.name) : entry.name;
        if (entry.isDirectory()) {
          walk(full, rel);
        } else if (entry.isFile() && (entry.name === "page.tsx" || entry.name === "page.ts")) {
          pageFiles.push({ full, rel });
        }
      }
    }
    if (fs.existsSync(appDir)) {
      walk(appDir, "");
    }
    for (const { full, rel } of pageFiles) {
      const parts = rel.replace(/\\/g, "/").split("/");
      const routeParts = parts.slice(0, -1); // remove page.tsx
      const route = "/" + routeParts
        .map((p) => p.replace(/^\[(.+)\]$/, ":$1"))
        .join("/")
        .replace(/\/$/, "") || "/";
      const id = slugify("page-" + route.replace(/[\/:]/g, "-").replace(/^-/, ""));
      pages.push({
        id: id || "page-index",
        title: route === "/" ? "Home" : route.split("/").pop().replace(/-/g, " ").replace(/^./, (c) => c.toUpperCase()),
        route,
        file: path.relative(projectDir, full).replace(/\\/g, "/"),
        kind: "page",
        mockStrategy: "screenshot",
        framework: "nextjs-app",
        mockFile: `mocks/${id || "page-index"}.tsx`,
        seedFile: `seed/${id || "page-index"}.json`,
        annotationFile: `annotations/${id || "page-index"}.json`,
        components: [],
        apiCalls: [],
        personas: ["junior", "experienced"],
      });
    }

    // App Router API routes
    const apiFiles = [];
    function walkApi(dir, relBase) {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (entry.name.startsWith(".")) continue;
        const full = path.join(dir, entry.name);
        const rel = relBase ? path.join(relBase, entry.name) : entry.name;
        if (entry.isDirectory()) {
          walkApi(full, rel);
        } else if (entry.isFile() && (entry.name === "route.ts" || entry.name === "route.tsx")) {
          apiFiles.push({ full, rel });
        }
      }
    }
    const apiDir = path.join(appDir, "api");
    if (fs.existsSync(apiDir)) {
      walkApi(apiDir, "api");
    }
    for (const { full, rel } of apiFiles) {
      const parts = rel.replace(/\\/g, "/").split("/");
      const routeParts = parts.slice(0, -1);
      const route = "/" + routeParts
        .map((p) => p.replace(/^\[(.+)\]$/, ":$1"))
        .join("/");
      const id = slugify("api-" + route.replace(/[\/:]/g, "-"));
      pages.push({
        id,
        title: (routeParts[routeParts.length - 1] || "route").replace(/-/g, " ").replace(/^./, (c) => c.toUpperCase()),
        route,
        file: path.relative(projectDir, full).replace(/\\/g, "/"),
        kind: "endpoint",
        mockStrategy: "structural",
        framework: "nextjs-app",
        mockFile: `mocks/${id}.tsx`,
        seedFile: `seed/${id}.json`,
        annotationFile: `annotations/${id}.json`,
        components: [],
        apiCalls: [],
        personas: ["junior", "experienced"],
      });
    }
  }

  // Pages Router — recursive walk of pages/ directory
  if (fs.existsSync(pagesDir)) {
    function walkPages(dir, routePrefix) {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (entry.name.startsWith("_")) continue;
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          walkPages(full, routePrefix ? path.join(routePrefix, entry.name) : "");
        } else if (entry.isFile() && /\.(tsx|ts|js)$/.test(entry.name)) {
          const name = entry.name.replace(/\.(tsx|ts|js)$/, "").replace(/^index$/, "");
          const routePart = routePrefix ? routePrefix.replace(/\\/g, "/") : "";
          const fileName = name ? "/" + name : "";
          const route = "/" + routePart + fileName;
          // Handle dynamic segments like [id]
          const cleanRoute = route.replace(/\[([^\]]+)\]/g, ":$1");
          pages.push({
            id: slugify("pages-" + (routePart + name || "index")),
            title: name ? name.replace(/-/g, " ").replace(/^./, (c) => c.toUpperCase()) : routePart.split("/").pop()?.replace(/-/g, " ").replace(/^./, (c) => c.toUpperCase()) ?? "Home",
            route: cleanRoute,
            file: path.relative(projectDir, full).replace(/\\/g, "/"),
            kind: "page",
            mockStrategy: "screenshot",
            framework: "nextjs-pages",
            mockFile: `mocks/${slugify("pages-" + (routePart + name || "index"))}.tsx`,
            seedFile: `seed/${slugify("pages-" + (routePart + name || "index"))}.json`,
            annotationFile: `annotations/${slugify("pages-" + (routePart + name || "index"))}.json`,
            components: [],
            apiCalls: [],
            personas: ["junior", "experienced"],
          });
        }
      }
    }
    walkPages(pagesDir, "");
  }

  return pages;
}

/** 3: Express / Fastify / Hono */
function detectExpressLike(projectDir) {
  /** @type {Page[]} */
  const pages = [];
  const appPattern = /app\.(get|post|put|delete|patch|all)\(['"`](\/[^'"`]+)['"`]/g;
  const routerPattern = /router\.(get|post|put|delete|patch|all)\(['"`](\/[^'"`]+)['"`]/g;
  const routeDirPattern = /routes?\/|controllers?\//;

  const jsFiles = findFiles(projectDir, ".js")
    .concat(findFiles(projectDir, ".mjs"))
    .concat(findFiles(projectDir, ".cjs"));

  // Filter to common source dirs or root
  const srcFiles = [];
  function collectFiles(dir) {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.name.startsWith(".") || entry.name === "node_modules") continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        collectFiles(full);
      } else if (entry.isFile() && /\.(js|mjs|cjs|ts)$/.test(entry.name)) {
        srcFiles.push(full);
      }
    }
  }
  collectFiles(projectDir);

  for (const file of srcFiles) {
    const rel = path.relative(projectDir, file).replace(/\\/g, "/");
    const content = readFileLines(file).join("\n");
    let match;
    // Reset regex
    appPattern.lastIndex = 0;
    routerPattern.lastIndex = 0;
    while ((match = appPattern.exec(content)) !== null) {
      const [_, method, routePath] = match;
      pages.push({
        id: slugify(`express-${routePath}`),
        title: `${method.toUpperCase()} ${routePath}`,
        route: routePath,
        file: rel,
        kind: "endpoint",
        mockStrategy: "structural",
        framework: "express",
        mockFile: `mocks/${slugify(`express-${routePath}`)}.tsx`,
        seedFile: `seed/${slugify(`express-${routePath}`)}.json`,
        annotationFile: `annotations/${slugify(`express-${routePath}`)}.json`,
        components: [],
        apiCalls: [],
        personas: ["junior", "experienced"],
      });
    }
    while ((match = routerPattern.exec(content)) !== null) {
      const [_, method, routePath] = match;
      pages.push({
        id: slugify(`route-${routePath}`),
        title: `${method.toUpperCase()} ${routePath}`,
        route: routePath,
        file: rel,
        kind: "endpoint",
        mockStrategy: "structural",
        framework: "express",
        mockFile: `mocks/${slugify(`route-${routePath}`)}.tsx`,
        seedFile: `seed/${slugify(`route-${routePath}`)}.json`,
        annotationFile: `annotations/${slugify(`route-${routePath}`)}.json`,
        components: [],
        apiCalls: [],
        personas: ["junior", "experienced"],
      });
    }
  }

  // Also look for route files in routes/ or controllers/ directories
  for (const file of srcFiles) {
    const rel = path.relative(projectDir, file).replace(/\\/g, "/");
    if (routeDirPattern.test(rel)) {
      const existingIds = new Set(pages.map((p) => p.id));
      const fileName = path.basename(file, path.extname(file));
      const id = slugify("route-file-" + fileName);
      if (!existingIds.has(id)) {
        pages.push({
          id,
          title: fileName.replace(/-/g, " ").replace(/^./, (c) => c.toUpperCase()),
          route: "/" + fileName,
          file: rel,
          kind: "endpoint",
          mockStrategy: "structural",
          framework: "express",
          mockFile: `mocks/${id}.tsx`,
          seedFile: `seed/${id}.json`,
          annotationFile: `annotations/${id}.json`,
          components: [],
          apiCalls: [],
          personas: ["junior", "experienced"],
        });
      }
    }
  }

  return pages;
}

/** 4: CLI commands */
function detectCLI(projectDir) {
  /** @type {Page[]} */
  const pages = [];
  const pkgPath = path.join(projectDir, "package.json");

  // package.json#bin entries
  if (exists(pkgPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
      const bins = pkg.bin;
      if (bins) {
        const entries = typeof bins === "string" ? { [pkg.name || "cli"]: bins } : bins;
        for (const [name, binPath] of Object.entries(entries)) {
          const fullPath = path.resolve(projectDir, binPath);
          pages.push({
            id: slugify("cli-" + name),
            title: name,
            route: name,
            file: path.relative(projectDir, fullPath).replace(/\\/g, "/"),
            kind: "command",
            mockStrategy: "template",
            framework: "cli",
            mockFile: `mocks/${slugify("cli-" + name)}.tsx`,
            seedFile: `seed/${slugify("cli-" + name)}.json`,
            annotationFile: `annotations/${slugify("cli-" + name)}.json`,
            components: [],
            apiCalls: [],
            personas: ["junior", "experienced"],
          });
        }
        if (entries.length > 0) return pages;
      }
    } catch { /* ignore */ }
  }

  // commander/yargs patterns
  const tsFiles = findFiles(projectDir, ".ts")
    .concat(findFiles(projectDir, ".js"))
    .concat(findFiles(projectDir, ".mjs"));
  for (const file of tsFiles) {
    const rel = path.relative(projectDir, file).replace(/\\/g, "/");
    const content = readFileLines(file).join("\n");
    const cmdPattern = /\.command\(['"`](\S+)['"`]/g;
    let match;
    while ((match = cmdPattern.exec(content)) !== null) {
      const cmdName = match[1].split(" ")[0];
      const existingIds = new Set(pages.map((p) => p.id));
      const id = slugify("cmd-" + cmdName);
      if (!existingIds.has(id)) {
        pages.push({
          id,
          title: cmdName,
          route: cmdName,
          file: rel,
          kind: "command",
          mockStrategy: "template",
          framework: "cli",
          mockFile: `mocks/${id}.tsx`,
          seedFile: `seed/${id}.json`,
          annotationFile: `annotations/${id}.json`,
          components: [],
          apiCalls: [],
          personas: ["junior", "experienced"],
        });
      }
    }
  }

  // click/typer Python patterns
  const pyFiles = findFiles(projectDir, ".py");
  for (const file of pyFiles) {
    const rel = path.relative(projectDir, file).replace(/\\/g, "/");
    const content = readFileLines(file).join("\n");
    const clickPattern = /@(click\.command|app\.command)\(\)|@click\.command\(['"`](\S+)['"`]\)/g;
    let match;
    while ((match = clickPattern.exec(content)) !== null) {
      const cmdName = match[2] || path.basename(file, ".py");
      const existingIds = new Set(pages.map((p) => p.id));
      const id = slugify("py-cmd-" + cmdName);
      if (!existingIds.has(id)) {
        pages.push({
          id,
          title: cmdName,
          route: cmdName,
          file: rel,
          kind: "command",
          mockStrategy: "template",
          framework: "cli",
          mockFile: `mocks/${id}.tsx`,
          seedFile: `seed/${id}.json`,
          annotationFile: `annotations/${id}.json`,
          components: [],
          apiCalls: [],
          personas: ["junior", "experienced"],
        });
      }
    }
  }

  return pages;
}

/** 5: Library exports */
function detectLibrary(projectDir) {
  /** @type {Page[]} */
  const pages = [];

  // Find index files at root or in src/
  const indexCandidates = [
    path.join(projectDir, "index.ts"),
    path.join(projectDir, "index.js"),
    path.join(projectDir, "index.mjs"),
    path.join(projectDir, "src/index.ts"),
    path.join(projectDir, "src/index.js"),
    path.join(projectDir, "__init__.py"),
  ];

  const exportPattern = /export\s+(function|class|const|default|interface|type)\s+(\w+)/g;
  const docstringPattern = /"""([^"]+)"""/;

  for (const indexPath of indexCandidates) {
    if (!exists(indexPath)) continue;
    const rel = path.relative(projectDir, indexPath).replace(/\\/g, "/");
    const content = readFileLines(indexPath).join("\n");
    let match;
    while ((match = exportPattern.exec(content)) !== null) {
      const [_, keyword, name] = match;
      pages.push({
        id: slugify("export-" + name),
        title: name,
        route: name,
        file: rel,
        kind: "export",
        mockStrategy: "structural",
        framework: "library",
        mockFile: `mocks/${slugify("export-" + name)}.tsx`,
        seedFile: `seed/${slugify("export-" + name)}.json`,
        annotationFile: `annotations/${slugify("export-" + name)}.json`,
        components: [],
        apiCalls: [],
        personas: ["junior", "experienced"],
      });
    }
  }

  return pages;
}

/** 6: Default — scan HTML files or emit a single app page */
function detectDefault(projectDir) {
  /** @type {Page[]} */
  const pages = [];
  const htmlFiles = findFiles(projectDir, ".html");

  if (htmlFiles.length === 0) {
    // No HTML files — emit a single "application" page for non-web projects
    console.warn("Warning: no HTML files found; emitting generic 'application' page");
    pages.push({
      id: "application",
      title: "Application",
      route: "/",
      file: "",  // generic application, no specific source file
      kind: "page",
      mockStrategy: "screenshot",
      framework: "unknown",
      mockFile: "mocks/application.tsx",
      seedFile: "seed/application.json",
      annotationFile: "annotations/application.json",
      components: [],
      apiCalls: [],
      personas: ["junior", "experienced"],
    });
    return pages;
  }

  for (const file of htmlFiles) {
    const rel = path.relative(projectDir, file).replace(/\\/g, "/");
    const name = path.basename(file, ".html");
      pages.push({
        id: slugify("html-" + name),
        title: name.replace(/-/g, " ").replace(/^./, (c) => c.toUpperCase()),
        route: "/" + (name === "index" ? "" : name),
        file: rel,
        kind: "page",
        mockStrategy: "screenshot",
        framework: "unknown",
        mockFile: `mocks/${slugify("html-" + name)}.tsx`,
        seedFile: `seed/${slugify("html-" + name)}.json`,
        annotationFile: `annotations/${slugify("html-" + name)}.json`,
        components: [],
        apiCalls: [],
        personas: ["junior", "experienced"],
      });
  }

  return pages;
}

/** 7: Vue / Nuxt — scan pages/**\/*.vue + app.vue + layouts */
function detectVue(projectDir) {
  const pages = [];
  const patterns = [
    { dir: "pages", ext: ".vue", kind: "page", label: "vue-nuxt" },
    { dir: "src/pages", ext: ".vue", kind: "page", label: "vue-nuxt" },
  ];
  for (const { dir, ext, kind, label } of patterns) {
    const fullDir = path.join(projectDir, dir);
    if (!fs.existsSync(fullDir)) continue;
    const files = findFiles(fullDir, ext);
    for (const f of files) {
      const rel = path.relative(projectDir, f);
      const routeParts = path.relative(fullDir, f).replace(/\\/g, "/").replace(/\.vue$/, "").split("/");
      const route = "/" + routeParts.map((p) => p.replace(/^\[(.+)\]$/, ":$1").replace(/^_(.+)$/, ":$1")).join("/").replace(/\/$/, "") || "/";
      const id = slugify("vue-" + route.replace(/[\/:]/g, "-"));
      pages.push({
        id, title: route === "/" ? "Home" : routeParts[routeParts.length - 1] || "Page",
        route, file: rel, kind, mockStrategy: "structural", framework: "vue-nuxt",
        mockFile: `mocks/${id}.tsx`, seedFile: `seed/${id}.json`, annotationFile: `annotations/${id}.json`,
        components: [], apiCalls: [], personas: ["junior", "experienced"],
      });
    }
  }
  if (exists(path.join(projectDir, "app.vue"))) {
    const id = "vue-app";
    pages.push({
      id, title: "App", route: "/", file: "app.vue", kind: "page",
      mockStrategy: "structural", framework: "vue-nuxt",
      mockFile: `mocks/${id}.tsx`, seedFile: `seed/${id}.json`, annotationFile: `annotations/${id}.json`,
      components: [], apiCalls: [], personas: ["junior", "experienced"],
    });
  }
  return pages;
}

/** 8: SvelteKit — scan src/routes/**\/+page.svelte */
function detectSvelteKit(projectDir) {
  const pages = [];
  const routesDir = path.join(projectDir, "src", "routes");
  if (!fs.existsSync(routesDir)) return pages;
  const files = findFiles(routesDir, "+page.svelte");
  for (const f of files) {
    const rel = path.relative(projectDir, f);
    const routeParts = path.relative(routesDir, f).replace(/\\/g, "/").split("/").slice(0, -1);
    const route = "/" + routeParts.map((p) => p.replace(/^\[(.+)\]$/, ":$1").replace(/^\((.+)\)$/, "")).filter(Boolean).join("/") || "/";
    const id = slugify("svelte-" + route.replace(/[\/:]/g, "-"));
    pages.push({
      id, title: route === "/" ? "Home" : routeParts[routeParts.length - 1] || "Page",
      route, file: rel, kind: "page", mockStrategy: "structural", framework: "sveltekit",
      mockFile: `mocks/${id}.tsx`, seedFile: `seed/${id}.json`, annotationFile: `annotations/${id}.json`,
      components: [], apiCalls: [], personas: ["junior", "experienced"],
    });
  }
  return pages;
}

/** 9: NestJS — scan @Controller + @Get/@Post decorators */
function detectNestJS(projectDir) {
  const pages = [];
  const tsFiles = findFiles(projectDir, ".ts").filter((f) => !f.includes("node_modules") && !f.includes(".spec.") && !f.includes(".test."));
  for (const f of tsFiles) {
    const content = fs.readFileSync(f, "utf-8");
    const controllerMatch = content.match(/@Controller\s*\(\s*['"`]([^'"`]+)['"`]\s*\)/);
    if (!controllerMatch) continue;
    const basePath = controllerMatch[1];
    const routeMatches = content.matchAll(/@(Get|Post|Put|Delete|Patch)\s*\(\s*(?:['"`]([^'"`]*)['"`])?\s*\)\s*\n?\s*(?:async\s+)?(\w+)/g);
    for (const rm of routeMatches) {
      const method = rm[1].toLowerCase();
      const subPath = rm[2] ?? "";
      const handler = rm[3];
      const route = "/" + [basePath, subPath].filter(Boolean).join("/").replace(/\/\//g, "/");
      const id = slugify("nestjs-" + route.replace(/[\/:]/g, "-") + "-" + method);
      const rel = path.relative(projectDir, f);
      pages.push({
        id, title: handler || "Handler", route, file: rel, kind: "endpoint",
        mockStrategy: "structural", framework: "nestjs",
        mockFile: `mocks/${id}.tsx`, seedFile: `seed/${id}.json`, annotationFile: `annotations/${id}.json`,
        components: [], apiCalls: [], personas: ["junior", "experienced"],
      });
    }
  }
  return pages;
}

/** 10: FastAPI — scan @app.get/post(...) + APIRouter */
function detectFastAPI(projectDir) {
  const pages = [];
  const pyFiles = findFiles(projectDir, ".py").filter((f) => !f.includes("site-packages") && !f.includes("__pycache__") && !f.includes("venv") && !f.includes(".env"));
  for (const f of pyFiles) {
    const content = fs.readFileSync(f, "utf-8");
    const routerMatch = content.match(/(\w+)\s*=\s*(?:APIRouter|FastAPI)\s*\(/);
    const routerName = routerMatch ? routerMatch[1] : null;
    if (!routerName) continue;
    const routeMatches = content.matchAll(new RegExp(`@${routerName}\\.(get|post|put|delete|patch)\\s*\\(\\s*['"]([^'"]*)['"]`, "g"));
    for (const rm of routeMatches) {
      const method = rm[1];
      const route = rm[2] || "/";
      const id = slugify("fastapi-" + route.replace(/[\/:<>]/g, "-") + "-" + method);
      const rel = path.relative(projectDir, f);
      pages.push({
        id, title: route.split("/").filter(Boolean).pop() || "root",
        route, file: rel, kind: "endpoint",
        mockStrategy: "structural", framework: "fastapi",
        mockFile: `mocks/${id}.tsx`, seedFile: `seed/${id}.json`, annotationFile: `annotations/${id}.json`,
        components: [], apiCalls: [], personas: ["junior", "experienced"],
      });
    }
  }
  return pages;
}

/** 11: Flask — scan @app.route(...) */
function detectFlask(projectDir) {
  const pages = [];
  const pyFiles = findFiles(projectDir, ".py").filter((f) => !f.includes("site-packages") && !f.includes("__pycache__") && !f.includes("venv") && !f.includes(".env"));
  for (const f of pyFiles) {
    const content = fs.readFileSync(f, "utf-8");
    const routeMatches = content.matchAll(/@(?:app|blueprint)\.route\s*\(\s*['"]([^'"]*)['"]\s*(?:,\s*methods\s*=\s*\[([^\]]*)\])?/g);
    for (const rm of routeMatches) {
      const route = rm[1];
      const methods = rm[2] ? rm[2].split(",").map((m) => m.trim().replace(/['"]/g, "").toLowerCase()) : ["get"];
      for (const method of methods) {
        const id = slugify("flask-" + route.replace(/[\/:<>]/g, "-") + "-" + method);
        const rel = path.relative(projectDir, f);
        pages.push({
          id, title: route.split("/").filter(Boolean).pop() || "root",
          route, file: rel, kind: "endpoint",
          mockStrategy: "structural", framework: "flask",
          mockFile: `mocks/${id}.tsx`, seedFile: `seed/${id}.json`, annotationFile: `annotations/${id}.json`,
          components: [], apiCalls: [], personas: ["junior", "experienced"],
        });
      }
    }
  }
  return pages;
}

/** 12: Rails — scan config/routes.rb + app/controllers/**\/*.rb */
function detectRails(projectDir) {
  const pages = [];
  const routesFile = path.join(projectDir, "config", "routes.rb");
  if (!exists(routesFile)) return pages;
  const routesContent = fs.readFileSync(routesFile, "utf-8");
  const resourceMatches = routesContent.matchAll(/(?:resources|resource)\s+:\s*(\w+)/g);
  const controllerFiles = findFiles(path.join(projectDir, "app", "controllers"), ".rb").filter((f) => !f.endsWith("application_controller.rb"));
  for (const cf of controllerFiles) {
    const rel = path.relative(projectDir, cf);
    const name = path.basename(cf, "_controller.rb");
    const route = "/" + name;
    const id = slugify("rails-" + name);
    pages.push({
      id, title: name.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase()),
      route, file: rel, kind: "endpoint", mockStrategy: "structural", framework: "rails",
      mockFile: `mocks/${id}.tsx`, seedFile: `seed/${id}.json`, annotationFile: `annotations/${id}.json`,
      components: [], apiCalls: [], personas: ["junior", "experienced"],
    });
  }
  return pages;
}

/** 13: Remix — scan app/routes/**\/*.{ts,tsx} or app/**\/route.ts */
function detectRemix(projectDir) {
  const pages = [];
  const patterns = [
    { dir: "app/routes", ext: ".tsx", kind: "page" },
    { dir: "app/routes", ext: ".ts", kind: "page" },
  ];
  for (const { dir, ext, kind } of patterns) {
    const fullDir = path.join(projectDir, dir);
    if (!fs.existsSync(fullDir)) continue;
    const files = findFiles(fullDir, ext);
    for (const f of files) {
      const rel = path.relative(projectDir, f);
      const routeParts = path.relative(fullDir, f).replace(/\\/g, "/").replace(/\.(tsx|ts)$/, "").split("/");
      const route = "/" + routeParts.map((p) => p.replace(/^\[(.+)\]$/, ":$1").replace(/^_/, "")).join("/").replace(/\/$/, "") || "/";
      const id = slugify("remix-" + route.replace(/[\/:]/g, "-"));
      pages.push({
        id, title: route === "/" ? "Home" : routeParts[routeParts.length - 1] || "Page",
        route, file: rel, kind, mockStrategy: "structural", framework: "remix",
        mockFile: `mocks/${id}.tsx`, seedFile: `seed/${id}.json`, annotationFile: `annotations/${id}.json`,
        components: [], apiCalls: [], personas: ["junior", "experienced"],
      });
    }
  }
  return pages;
}

/** 14: Astro — scan src/pages/**\/*.{astro,tsx} */
function detectAstro(projectDir) {
  const pages = [];
  const pagesDir = path.join(projectDir, "src", "pages");
  if (!fs.existsSync(pagesDir)) return pages;
  const exts = [".astro", ".tsx", ".md"];
  for (const ext of exts) {
    const files = findFiles(pagesDir, ext);
    for (const f of files) {
      const rel = path.relative(projectDir, f);
      const routeParts = path.relative(pagesDir, f).replace(/\\/g, "/").replace(new RegExp(ext.replace(".", "\\.") + "$"), "").split("/");
      const route = "/" + routeParts.map((p) => p.replace(/^\[(.+)\]$/, ":$1").replace(/^index$/, "")).filter(Boolean).join("/") || "/";
      const id = slugify("astro-" + route.replace(/[\/:]/g, "-"));
      pages.push({
        id, title: route === "/" ? "Home" : routeParts[routeParts.length - 1] || "Page",
        route, file: rel, kind: "page", mockStrategy: "structural", framework: "astro",
        mockFile: `mocks/${id}.tsx`, seedFile: `seed/${id}.json`, annotationFile: `annotations/${id}.json`,
        components: [], apiCalls: [], personas: ["junior", "experienced"],
      });
    }
  }
  return pages;
}

/* ------------------------------------------------------------------ */
/*  Main detection pipeline                                           */
/* ------------------------------------------------------------------ */

/**
 * @param {string} projectDir
 * @param {{ noLlm?: boolean }} options
 * @returns {PageDetection}
 */
export function detectPages(projectDir, options = {}) {
  const maxPages = options.maxPages ?? 50;
  const allPages = [];

  // Run all strategies
  allPages.push(...detectNextJS(projectDir));
  allPages.push(...detectExpressLike(projectDir));
  allPages.push(...detectCLI(projectDir));
  allPages.push(...detectLibrary(projectDir));
  allPages.push(...detectVue(projectDir));
  allPages.push(...detectSvelteKit(projectDir));
  allPages.push(...detectNestJS(projectDir));
  allPages.push(...detectFastAPI(projectDir));
  allPages.push(...detectFlask(projectDir));
  allPages.push(...detectRails(projectDir));
  allPages.push(...detectRemix(projectDir));
  allPages.push(...detectAstro(projectDir));

  // Deduplicate by id
  const seen = new Set();
  let pages = allPages.filter((p) => {
    if (seen.has(p.id)) return false;
    seen.add(p.id);
    return true;
  });

  // Verify every file exists on disk
  for (const p of pages) {
    const fullPath = path.resolve(projectDir, p.file);
    if (!exists(fullPath)) {
      console.warn(`Warning: ${p.file} does not exist on disk (page ${p.id})`);
    }
  }

  // Detect framework (first match wins, ordered by specificity)
  const FRAMEWORK_PRIORITY = [
    "nextjs-app", "nextjs-pages", "remix", "astro", "sveltekit", "vue-nuxt",
    "nestjs", "fastapi", "flask", "rails", "express", "cli", "library",
  ];
  const frameworks = new Set(pages.map((p) => p.framework).filter(Boolean));
  const framework = FRAMEWORK_PRIORITY.find((f) => frameworks.has(f)) ?? "unknown";

  // If no pages detected and not --no-llm, try default detection
  if (pages.length === 0 && !options.noLlm) {
    pages.push(...detectDefault(projectDir));
  }

  // Under --no-llm, warn if framework is unknown
  if (options.noLlm && framework === "unknown") {
    console.warn("Warning: unknown framework detected; pages may be incomplete. Use without --no-llm for LLM-assisted detection.");
  }

  // Apply max-pages cap (filter out files that don't exist first)
  let validPages = pages.filter((p) => {
    const fullPath = path.resolve(projectDir, p.file);
    return exists(fullPath);
  });

  const result = { framework, pages: validPages };

  // Sort by route for deterministic capping
  validPages.sort((a, b) => a.route.localeCompare(b.route));

  if (validPages.length > maxPages) {
    const totalPagesDetected = validPages.length;
    validPages = validPages.slice(0, maxPages);
    console.warn(`Detected ${totalPagesDetected} pages, capping at ${maxPages}. Use --max-pages to adjust.`);
    result.cappedAt = maxPages;
    result.totalPagesDetected = totalPagesDetected;
    result.pages = validPages;
  }

  return result;
}

/* ------------------------------------------------------------------ */
/*  CLI entry point                                                    */
/* ------------------------------------------------------------------ */

function main() {
  const args = process.argv.slice(2);
  let projectDir = process.cwd();
  let outputPath = null;
  let noLlm = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--no-llm") {
      noLlm = true;
    } else if (args[i] === "--output" && i + 1 < args.length) {
      outputPath = args[++i];
    } else if (!args[i].startsWith("--")) {
      projectDir = path.resolve(args[i]);
    }
  }

  if (!fs.existsSync(projectDir)) {
    console.error(`Error: directory not found: ${projectDir}`);
    process.exit(1);
  }

  const result = detectPages(projectDir, { noLlm });

  // Ensure output directory exists
  const outPath = outputPath || path.join(projectDir, ".ua", "mock-guide", "pages.json");
  const outDir = path.dirname(outPath);
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(result, null, 2), "utf-8");

  console.log(`Detected ${result.pages.length} pages in ${result.framework} project`);
  if (outputPath) {
    console.log(`Output: ${outputPath}`);
  }
}

if (process.argv[1] && (process.argv[1].endsWith("page-detector.mjs") || process.argv[1].endsWith("page-detector"))) {
  main();
}
