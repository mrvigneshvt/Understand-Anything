#!/usr/bin/env node
/**
 * mock-generator.mjs — generate self-contained mock pages with seeded data.
 *
 * Produces .tsx files that import ONLY from react, MockDataProvider, and inlined
 * constants — no target-project imports (@/lib/*, @/components/*, etc.).
 * These can be dynamically imported by Next.js's MockFrame for live rendering.
 */

import fs from "node:fs";
import path from "node:path";

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function exists(filePath) {
  try { return fs.statSync(filePath).isFile(); } catch { return false; }
}

function readFile(filePath) {
  try { return fs.readFileSync(filePath, "utf-8"); } catch { return ""; }
}

/** Extract handler names from JSX content (onClick, onSubmit, onChange, etc.) */
function extractHandlers(content) {
  const handlers = [];
  const pattern = /\b(on\w+)=\{(\w+)\}/g;
  let m;
  while ((m = pattern.exec(content)) !== null) {
    handlers.push({ event: m[1], handler: m[2] });
  }
  return handlers;
}

/** Extract apiGet/apiPost calls */
function extractApiCallsFromContent(content) {
  const calls = [];
  const patterns = [
    /apiGet<(?:[^>]+)?>\s*\(\s*['"`]([^'"`]+)['"`]/g,
    /apiPost<(?:[^>]+)?>\s*\(\s*['"`]([^'"`]+)['"`]/g,
    /apiPut<(?:[^>]+)?>\s*\(\s*['"`]([^'"`]+)['"`]/g,
    /apiDelete\s*\(\s*['"`]([^'"`]+)['"`]/g,
    /fetch\s*\(\s*['"`]([^'"`]+)['"`]/g,
  ];
  for (const pattern of patterns) {
    let m;
    while ((m = pattern.exec(content)) !== null) {
      calls.push(m[1]);
    }
  }
  return calls;
}

/** Detect page type from its route + pageId */
function detectPageType(pageId, route) {
  if (!route) return "unknown";
  const r = route.toLowerCase();
  const id = pageId.toLowerCase();

  if (r.includes("/login") || r.includes("/signin") || id.includes("login") || id.includes("signin")) return "login";
  if (r.includes("/register") || r.includes("/signup") || r.includes("/new") || id.includes("new") || id.includes("create") || id.includes("register")) return "form";
  if (r.includes("/settings") || r.includes("/preferences") || id.includes("settings") || id.includes("prefs")) return "settings";
  if (r.includes("/dashboard") || r === "/" || r === "" || id.includes("dashboard") || id.includes("home") || id.includes("index")) return "dashboard";
  if (r.includes("/:id") || r.includes("/[id]") || r.includes("/:userId") || r.includes("/[userId]") || (/\w+\/\d+/.test(r)) || id.includes("-id") || id.includes("detail") || id.includes("profile")) return "detail";
  if (r.includes("/api/") || r.startsWith("api/")) return "endpoint";
  return "list";
}

/** Generate seed data for login pages */
function loginSeed() {
  return {
    email: "demo@acme.io",
    password: "demo123",
    rememberMe: true,
    user: { id: "u1", name: "Alice Johnson", email: "alice@example.com", role: "admin" },
  };
}

/** Generate seed data for dashboard pages */
function dashboardSeed() {
  return {
    stats: [
      { label: "Total Users", value: 1284, change: "+12%", positive: true },
      { label: "Active Orders", value: 347, change: "+5%", positive: true },
      { label: "Revenue", value: 48250, change: "-2%", positive: false },
    ],
    recentActivity: [
      { action: "New user registered", time: "2 min ago" },
      { action: "Order #1234 shipped", time: "15 min ago" },
      { action: "Payment received", time: "1 hour ago" },
      { action: "Server deployment complete", time: "3 hours ago" },
    ],
    metrics: { users: 1284, orders: 347, revenue: 48250, pageViews: 15230 },
  };
}

/** Generate seed data for list pages */
function listSeed(route) {
  const r = (route || "").toLowerCase();
  if (r.includes("user")) {
    return {
      items: [
        { id: "u1", name: "Alice Johnson", email: "alice@example.com", role: "admin", status: "active", createdAt: "2024-01-15" },
        { id: "u2", name: "Bob Smith", email: "bob@example.com", role: "user", status: "active", createdAt: "2024-02-20" },
        { id: "u3", name: "Carol Davis", email: "carol@example.com", role: "user", status: "inactive", createdAt: "2024-03-10" },
        { id: "u4", name: "David Wilson", email: "david@example.com", role: "editor", status: "active", createdAt: "2024-04-05" },
        { id: "u5", name: "Eve Martin", email: "eve@example.com", role: "user", status: "active", createdAt: "2024-05-22" },
      ],
      total: 12,
      page: 1,
      perPage: 10,
    };
  }
  if (r.includes("order")) {
    return {
      items: [
        { id: "ord-001", product: "Widget Pro", amount: 29.99, status: "delivered", customer: "Alice Johnson", date: "2024-06-01" },
        { id: "ord-002", product: "Gadget X", amount: 49.99, status: "shipped", customer: "Bob Smith", date: "2024-06-05" },
        { id: "ord-003", product: "Thingamajig", amount: 15.50, status: "pending", customer: "Carol Davis", date: "2024-06-10" },
        { id: "ord-004", product: "Super Widget", amount: 99.99, status: "delivered", customer: "Alice Johnson", date: "2024-05-28" },
      ],
      total: 12,
      page: 1,
      perPage: 10,
    };
  }
  return {
    items: [
      { id: "item-1", name: "Item One", description: "First item description" },
      { id: "item-2", name: "Item Two", description: "Second item description" },
      { id: "item-3", name: "Item Three", description: "Third item description" },
    ],
    total: 8,
    page: 1,
    perPage: 10,
  };
}

/** Generate seed data for detail pages */
function detailSeed(route) {
  const r = (route || "").toLowerCase();
  if (r.includes("user")) {
    return {
      id: "u1",
      name: "Alice Johnson",
      email: "alice@example.com",
      role: "admin",
      status: "active",
      avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=alice",
      createdAt: "2024-01-15",
      lastLogin: "2024-06-10T08:30:00Z",
      bio: "Full-stack developer with 8 years of experience",
      company: "Acme Corp",
      location: "San Francisco, CA",
      projects: 12,
    };
  }
  if (r.includes("order")) {
    return {
      id: "ord-001",
      product: "Widget Pro",
      amount: 29.99,
      status: "delivered",
      customer: "Alice Johnson",
      email: "alice@example.com",
      shippingAddress: "123 Main St, San Francisco, CA 94102",
      paymentMethod: "Visa ****4242",
      orderedAt: "2024-06-01T10:30:00Z",
      deliveredAt: "2024-06-05T14:00:00Z",
      items: [
        { name: "Widget Pro", qty: 2, price: 14.99 },
      ],
    };
  }
  if (r.includes("profile")) {
    return {
      displayName: "Alice Johnson",
      bio: "Full-stack developer passionate about building great products",
      company: "Acme Corp",
      location: "San Francisco, CA",
      website: "https://alice.dev",
      avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=alice",
      joinDate: "2024-01-15",
      stats: { posts: 42, followers: 128, following: 89 },
    };
  }
  return {
    id: "1",
    name: "Detail Item",
    description: "A detailed view of the item",
    createdAt: "2024-01-15",
    updatedAt: "2024-06-10",
  };
}

/** Generate seed data for settings pages */
function settingsSeed() {
  return {
    theme: "dark",
    notifications: true,
    language: "en",
    timezone: "UTC",
    emailUpdates: true,
    twoFactorAuth: false,
    profileVisibility: "public",
  };
}

/** Generate seed data for form pages */
function formSeed(route) {
  const r = (route || "").toLowerCase();
  if (r.includes("user") || r.includes("register") || r.includes("signup")) {
    return {
      fields: {
        name: "",
        email: "",
        role: "member",
        password: "",
        confirmPassword: "",
      },
      defaultRole: "member",
      roles: ["admin", "editor", "member"],
    };
  }
  return {
    fields: {
      title: "",
      description: "",
    },
    isSubmitting: false,
  };
}

function endpointSeed(route) {
  const r = (route || "").toLowerCase();
  if (r.includes("auth/login") || r.includes("auth/signin")) {
    return { token: "mock-jwt-token", user: { id: "u1", name: "Alice Johnson", email: "alice@example.com", role: "admin" } };
  }
  if (r.includes("dashboard")) return dashboardSeed();
  if (r.includes("users")) return listSeed(route);
  if (r.includes("orders")) return listSeed(route);
  if (r.includes("profile")) return detailSeed("profile");
  if (r.includes("settings")) return settingsSeed();
  return { ok: true, message: "Mock response" };
}

/** Generate deterministic seed data based on page type and route */
function generateSeed(pageId, apiCalls, route) {
  const pageType = detectPageType(pageId, route);

  let seeds = {};
  if (pageType === "login") seeds = loginSeed();
  else if (pageType === "dashboard") seeds = dashboardSeed();
  else if (pageType === "settings") seeds = settingsSeed();
  else if (pageType === "form") seeds = formSeed(route);
  else if (pageType === "detail") seeds = detailSeed(route);
  else if (pageType === "endpoint") seeds = endpointSeed(route);
  else seeds = listSeed(route);

  // Also populate from API call paths for any matching endpoints
  const apiSeed = {};
  for (const call of apiCalls) {
    if (call.includes("/api/dashboard")) apiSeed.dashboard = dashboardSeed();
    else if (call.includes("/api/users")) apiSeed.users = listSeed("users");
    else if (call.includes("/api/orders")) apiSeed.orders = listSeed("orders");
    else if (call.includes("/api/settings")) apiSeed.settings = settingsSeed();
    else if (call.includes("/api/profile")) apiSeed.profile = detailSeed("profile");
  }

  return { ...seeds, ...apiSeed };
}

/**
 * Build an inline stub for @/lib/api module functions.
 * Returns source that defines apiGet/apiPost/apiPut/apiDelete that resolve from seed.
 */
function buildApiStub(seed) {
  const seedJson = JSON.stringify(seed);
  return `// Inline API stub — resolves from seed data
const __seed = ${seedJson};
function __resolveFromSeed(path) {
  const data = __seed[Object.keys(__seed).find(k => path.includes(k))];
  return { data, error: undefined };
}
const apiGet = async (path) => __resolveFromSeed(path);
const apiPost = async (path, body) => __resolveFromSeed(path);
const apiPut = async (path, body) => __resolveFromSeed(path);
const apiDelete = async (path) => __resolveFromSeed(path);`;
}

/**
 * Build inline stub implementations for known hooks.
 */
function buildHookStubs(content, seed) {
  const stubs = [];
  const hookPatterns = [
    { import: /import\s+\{([^}]+)\}\s+from\s+["']@\/lib\/auth["']/g, stubs: buildAuthStub },
    { import: /import\s+\{([^}]+)\}\s+from\s+["']@\/lib\/authStore["']/g, stubs: buildAuthStoreStub },
  ];

  for (const pattern of hookPatterns) {
    let m;
    while ((m = pattern.import.exec(content)) !== null) {
      const names = m[1].split(",").map((s) => s.trim());
      const stubSource = pattern.stubs(names, seed);
      stubs.push(stubSource);
    }
  }
  return stubs;
}

function buildAuthStub(names, seed) {
  const authData = { token: "mock-token-abc", user: { id: "u1", name: "Alice Johnson", email: "alice@example.com", role: "admin" } };
  const authStr = JSON.stringify(authData);
  const userStr = JSON.stringify(authData.user);
  return `// Inline auth hook stub
const useAuth = () => ({
  login: async () => (${authStr}),
  logout: () => {},
  loading: false,
  error: null,
  isAuthenticated: true,
  user: ${userStr},
});`;
}

function buildAuthStoreStub(names, seed) {
  return `// Inline auth store stub
const useAuthStore = () => ({
  token: "mock-token-abc",
  user: { id: "u1", name: "Alice Johnson", email: "alice@example.com", role: "admin" },
  login: async () => {},
  logout: () => {},
  isAuthenticated: true,
});`;
}

/**
 * Build inline stub components for known @/components/* imports.
 */
function buildComponentStubs(content) {
  const stubs = [];
  const compRegex = /import\s+\{([^}]+)\}\s+from\s+["']@\/components\/(\w+)["']/g;
  let m;
  while ((m = compRegex.exec(content)) !== null) {
    const names = m[1].split(",").map((s) => s.trim());
    const compName = m[2];
    for (const name of names) {
      stubs.push(`// Inline stub for @/components/${compName}
const ${name} = (props) => {
  const { title, value, change, positive, ...rest } = props;
  return React.createElement("div", { style: { padding: "16px", border: "1px solid #e5e7eb", borderRadius: "8px", background: "#f9fafb" }, "data-ua-binding": title || name },
    React.createElement("h3", { style: { margin: "0 0 4px", fontSize: "14px", fontWeight: 600, color: "#374151" } }, title || props.label || props.name),
    props.children ? props.children : (
      value !== undefined ? React.createElement("p", { style: { fontSize: "24px", fontWeight: 700, margin: 0 } }, String(value)) : null
    ),
    change ? React.createElement("span", { style: { fontSize: "12px", color: positive ? "#059669" : "#dc2626" } }, change) : null
  );
};`);
    }
  }
  return stubs;
}

/**
 * Replace hook call destructuring like `const { login, loading, ... } = useAuth()`
 * with inline mock values.
 */
function replaceHookCalls(content) {
  let result = content;

  // React à la `const { login, loading, error, isAuthenticated } = useAuth();`
  result = result.replace(
    /const\s+\{([^}]+)\}\s*=\s*useAuth\(\)/g,
    (_, props) => {
      const propNames = props.split(",").map((s) => s.trim());
      const values = propNames.map((name) => {
        if (name === "login") return `login: async () => {}`;
        if (name === "logout") return `logout: () => {}`;
        if (name === "loading") return `loading: false`;
        if (name === "error") return `error: null`;
        if (name === "isAuthenticated") return `isAuthenticated: true`;
        if (name === "user") return `user: { id: "u1", name: "Alice Johnson", email: "alice@example.com", role: "admin" }`;
        if (name === "token") return `token: "mock-token"`;
        return `${name}: undefined`;
      });
      return `const { ${props} } = { ${values.join(", ")} }`;
    }
  );

  return result;
}

/**
 * Replace fetch / apiGet / apiPost calls with Promise.resolve(seedData).
 */
function replaceApiCalls(content, seed) {
  let result = content;
  const seedJson = JSON.stringify(seed);

  // Replace `apiGet<Type>("path")` with `Promise.resolve(seedData) as any`
  result = result.replace(
    /api(?:Get|Post|Put|Delete)<(?:[^>]+)?>\s*\(\s*['"`][^'"`]+['"`]\s*(?:,\s*[^)]*)?\)/g,
    () => `Promise.resolve(${seedJson || "{}"})`
  );

  // Replace `fetch("path")` with `Promise.resolve({ ok: true, json: async () => (seedData) })`
  result = result.replace(
    /fetch\s*\(\s*['"`][^'"`]+['"`]\s*(?:,\s*[^)]*)?\)/g,
    () => `Promise.resolve({ ok: true, json: async () => (${seedJson || "{}"}), text: async () => JSON.stringify(${seedJson || "{}"}) })`
  );

  // Replace seedOrders(), seedUsers(), seedProfile(), seedSettings() calls with seed data
  const seedCalls = Object.keys(JSON.parse(seedJson || "{}"));
  result = result.replace(
    /seed(\w+)\(\)/g,
    (_, name) => {
      const key = name.toLowerCase();
      const matchingKey = seedCalls.find(k => k.includes(key) || key.includes(k));
      if (matchingKey) {
        return JSON.stringify(JSON.parse(seedJson)[matchingKey]);
      }
      return "{}";
    }
  );

  return result;
}

/**
 * Clean imports — strip everything except react, next/*, react-dom, and MockDataProvider.
 */
function cleanImports(content) {
  const lines = content.split("\n");
  const cleaned = [];
  let addedApiStub = false;
  let addedHookStubs = false;
  let addedCompStubs = false;

  for (const line of lines) {
    const trimmed = line.trim();

    if (trimmed.startsWith("import ") || trimmed.startsWith('"use client') || trimmed.startsWith("'use client")) {
      if (line.includes("@/lib/api")) {
        if (!addedApiStub) {
          cleaned.push(buildApiStub({}));
          addedApiStub = true;
        }
        continue;
      }
      if (line.includes("@/lib/auth") || line.includes("@/lib/authStore") || line.includes("@/lib/types")) {
        continue;
      }
      if (line.includes("@/components/")) {
        continue;
      }
      if (line.includes("@/")) {
        continue;
      }
      if (line.includes("next/") || line.includes("react") || line.includes("react-dom")) {
        cleaned.push(line);
        continue;
      }
      continue;
    }

    cleaned.push(line);
  }

  return cleaned.join("\n");
}

/**
 * Generate a fully self-contained mock component file.
 */
function generateMockComponent(pageId, pageName, pageRoute, originalContent, handlers, apiCalls, seed) {
  const funcMatch = originalContent.match(/(?:export default function|export function|function)\s+(\w+)/);
  const componentName = funcMatch ? funcMatch[1] : pageName.replace(/[^a-zA-Z0-9]/g, "");

  let content = originalContent;

  // 1. Clean imports — strip @/lib/*, @/components/*, keep react/next
  content = cleanImports(content);

  // 2. Replace hook calls (useAuth, etc.) with inline values
  content = replaceHookCalls(content);

  // 3. Replace fetch/apiGet/apiPost with seed-data resolves
  content = replaceApiCalls(content, seed);

  // 4. Replace `const [...] = useState(val)` with `const [...] = useSeed("...")`
  content = content.replace(
    /const\s+\[(\w+),\s*\w+\]\s*=\s*useState\(([^)]+)\)/g,
    (match, name, initial) => {
      return `const [${name}, set${name.charAt(0).toUpperCase() + name.slice(1)}] = useSeed<typeof ${name}>("${name}") !== undefined ? [useSeed<typeof ${name}>("${name}"), () => {}] : [${initial}, () => {}]`;
    }
  );

  // 5. Strip original export default so wrapper is sole export
  content = content.replace(/export\s+default\s+function\s+/g, "function ");

  // 6. Add data-ua-binding attributes to handler elements
  for (const { event, handler } of handlers) {
    const tagRegex = new RegExp(`(<\\w+(?:[^>]*?\\s)?${event}\\s*=\\s*\\{${handler}\\}[^>]*?)>`, "g");
    content = content.replace(tagRegex, (_, openingTag) => {
      if (openingTag.includes('data-ua-binding')) return `${_}>`;
      return `${openingTag} data-ua-binding="${handler}">`;
    });
  }

  // 7. Add preamble – imports + seed data + stubs
  const preamble = [
    `// @ts-nocheck — generated by mock-generator.mjs, do not edit`,
    `"use client";`,
    `import React from "react";`,
    `import { MockDataProvider, useSeed } from "@/mocks/MockDataProvider";`,
    ``,
    `const seedData = ${JSON.stringify(seed, null, 2)};`,
    ``,
  ];

  // Add component stubs if any @/components/* imports were detected
  const compStubs = buildComponentStubs(originalContent);
  if (compStubs.length > 0) {
    preamble.push(...compStubs);
    preamble.push("");
  }

  // Add hook stubs if any @/lib/auth imports were detected
  const hookStubs = buildHookStubs(originalContent, seed);
  if (hookStubs.length > 0) {
    preamble.push(...hookStubs);
    preamble.push("");
  }

  // 8. Build final content
  const fullContent = preamble.join("\n") + content;

  // 9. Wrap in MockDataProvider
  const finalContent = fullContent +
    `\n\nexport default function ${componentName}Mock() {\n` +
    `  return (\n` +
    `    <MockDataProvider pageId="${pageId}" seedData={seedData}>\n` +
    `      <${componentName} />\n` +
    `    </MockDataProvider>\n` +
    `  );\n}\n`;

  return finalContent;
}

/* ------------------------------------------------------------------ */
/*  Main generator                                                     */
/* ------------------------------------------------------------------ */

/**
 * @param {string} projectDir
 * @param {{ noLlm?: boolean }} options
 * @returns {{ mocks: number; seeds: number }}
 */
export function generateMocks(projectDir, options = {}) {
  const pagesPath = path.join(projectDir, ".ua", "mock-guide", "pages.json");
  const apiMapPath = path.join(projectDir, ".ua", "mock-guide", "api-map.json");

  /** @type {{ pages: any[] }} */
  let pagesJson;
  try { pagesJson = JSON.parse(readFile(pagesPath)); } catch { return { mocks: 0, seeds: 0 }; }

  /** @type {import('./api-mapper.mjs').ApiMap} */
  let apiMap;
  try { apiMap = JSON.parse(readFile(apiMapPath)); } catch { apiMap = {}; }

  const pages = pagesJson.pages || [];
  const callsByPage = {};
  for (const pageId of Object.keys(apiMap)) {
    callsByPage[pageId] = apiMap[pageId]?.calls || [];
  }

  const mocksDir = path.join(projectDir, ".ua", "mock-guide", "mocks");
  const seedsDir = path.join(projectDir, ".ua", "mock-guide", "seed");
  fs.mkdirSync(mocksDir, { recursive: true });
  fs.mkdirSync(seedsDir, { recursive: true });

  let mockCount = 0;
  let seedCount = 0;

  for (const page of pages) {
    const pageFile = path.resolve(projectDir, page.file);
    if (!exists(pageFile)) {
      console.warn(`Warning: page file not found: ${page.file}`);
      continue;
    }

    const content = readFile(pageFile);
    const handlers = extractHandlers(content);
    const apiCalls = extractApiCallsFromContent(content);
    const pageCalls = callsByPage[page.id] || [];
    const allPaths = [...apiCalls, ...pageCalls.map((c) => c.endpoint)];

    // Generate seed data
    const seed = generateSeed(page.id, allPaths, page.route);
    const seedPath = path.join(seedsDir, `${page.id}.json`);
    fs.writeFileSync(seedPath, JSON.stringify(seed, null, 2), "utf-8");
    seedCount++;

    // Generate mock component with screenshot→structural fallback
    const isScreenshot = page.mockStrategy === "screenshot";
    if (isScreenshot) {
      console.warn(`Falling back to structural mode for ${page.id} (${page.mockStrategy} unavailable)`);
    }
    const mockContent = generateMockComponent(
      page.id, page.title, page.route,
      content, handlers, allPaths, seed,
    );
    const mockPath = path.join(mocksDir, `${page.id}.tsx`);
    fs.writeFileSync(mockPath, mockContent, "utf-8");
    mockCount++;
  }

  console.log(`Generated ${mockCount} mocks and ${seedCount} seed files`);
  return { mocks: mockCount, seeds: seedCount };
}

/* ------------------------------------------------------------------ */
/*  CLI entry point                                                    */
/* ------------------------------------------------------------------ */

function main() {
  const args = process.argv.slice(2);
  let projectDir = process.cwd();
  let noLlm = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--no-llm") noLlm = true;
    else if (!args[i].startsWith("--")) projectDir = path.resolve(args[i]);
  }

  if (!fs.existsSync(projectDir)) {
    console.error(`Error: directory not found: ${projectDir}`);
    process.exit(1);
  }

  generateMocks(projectDir, { noLlm });
}

if (process.argv[1] && (process.argv[1].endsWith("mock-generator.mjs") || process.argv[1].endsWith("mock-generator"))) {
  main();
}
