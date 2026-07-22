import { describe, it, expect } from "vitest";

// Test the GraphNode builder and Page-id adapter logic
// by replicating the buildGraphNodes function

interface Page {
  id: string;
  title: string;
  route: string;
  kind: string;
  framework: string;
  file: string;
}

interface ApiCall {
  id: string;
  method: string;
  endpoint: string;
  file: string;
}

type ApiMap = Record<string, { calls: ApiCall[]; schemas: { name: string; kind: string }[] }>;

interface GraphNode {
  id: string;
  type: string;
  name: string;
  summary: string;
  tags: string[];
}

function buildGraphNodes(pages: Page[], apiMap: ApiMap): GraphNode[] {
  const nodes: GraphNode[] = [];
  const seenIds = new Set<string>();

  for (const p of pages) {
    const id = `page:${p.id}`;
    if (seenIds.has(id)) continue;
    seenIds.add(id);
    nodes.push({ id, type: "page", name: p.title ?? p.id, summary: p.route ?? "/", tags: [p.kind ?? "page", p.framework ?? "unknown"] });
  }

  for (const [, entry] of Object.entries(apiMap)) {
    for (const call of entry.calls ?? []) {
      const id = `api:${call.id}`;
      if (seenIds.has(id)) continue;
      seenIds.add(id);
      nodes.push({ id, type: "endpoint", name: `${call.method} ${call.endpoint}`, summary: call.endpoint ?? "", tags: ["api", call.method ?? "GET"] });
    }
    for (const schema of entry.schemas ?? []) {
      const id = `schema:${schema.name}`;
      if (seenIds.has(id)) continue;
      seenIds.add(id);
      nodes.push({ id, type: "schema", name: schema.name, summary: schema.kind ?? "unknown", tags: ["schema", schema.kind ?? "unknown"] });
    }
  }

  return nodes;
}

describe("SearchBar GraphNode builder", () => {
  it("converts Page to GraphNode with page:id prefix", () => {
    const pages: Page[] = [{ id: "login", title: "Login", route: "/login", kind: "page", framework: "nextjs-app", file: "app/login/page.tsx" }];
    const apiMap: ApiMap = {};
    const nodes = buildGraphNodes(pages, apiMap);

    expect(nodes).toHaveLength(1);
    expect(nodes[0]?.id).toBe("page:login");
    expect(nodes[0]?.name).toBe("Login");
    expect(nodes[0]?.summary).toBe("/login");
    expect(nodes[0]?.tags).toContain("page");
    expect(nodes[0]?.tags).toContain("nextjs-app");
  });

  it("converts ApiCall to GraphNode with api: prefix", () => {
    const pages: Page[] = [];
    const apiMap: ApiMap = { "dashboard": { calls: [{ id: "dashboard.get-users", method: "GET", endpoint: "/api/users", file: "app/dashboard/page.tsx" }], schemas: [] } };
    const nodes = buildGraphNodes(pages, apiMap);

    expect(nodes).toHaveLength(1);
    expect(nodes[0]?.id).toBe("api:dashboard.get-users");
    expect(nodes[0]?.name).toContain("GET");
    expect(nodes[0]?.name).toContain("/api/users");
    expect(nodes[0]?.tags).toContain("api");
  });

  it("converts SchemaRef to GraphNode with schema: prefix", () => {
    const pages: Page[] = [];
    const apiMap: ApiMap = { "dashboard": { calls: [], schemas: [{ name: "UserSchema", kind: "zod" }] } };
    const nodes = buildGraphNodes(pages, apiMap);

    expect(nodes).toHaveLength(1);
    expect(nodes[0]?.id).toBe("schema:UserSchema");
    expect(nodes[0]?.name).toBe("UserSchema");
    expect(nodes[0]?.summary).toBe("zod");
  });

  it("deduplicates nodes with the same id", () => {
    const pages: Page[] = [
      { id: "login", title: "Login", route: "/login", kind: "page", framework: "nextjs-app", file: "a.tsx" },
      { id: "login", title: "Login", route: "/login", kind: "page", framework: "nextjs-app", file: "b.tsx" }, // same id
    ];
    const apiMap: ApiMap = {};
    const nodes = buildGraphNodes(pages, apiMap);

    expect(nodes).toHaveLength(1);
  });

  it("maps GraphNode id back to Page id (Page-id adapter)", () => {
    const nodes = buildGraphNodes(
      [{ id: "dashboard", title: "Dashboard", route: "/dashboard", kind: "page", framework: "nextjs-app", file: "app/dashboard/page.tsx" }],
      {}
    );

    // The adapter: strip "page:" prefix to get back the Page id
    for (const node of nodes) {
      if (node.type === "page" && node.id.startsWith("page:")) {
        const pageId = node.id.slice(5);
        expect(pageId).toBe("dashboard");
      }
    }
  });

  it("query 'auth' returns ≥1 result when pages contain 'auth'", () => {
    const pages: Page[] = [
      { id: "login", title: "Login", route: "/login", kind: "page", framework: "nextjs-app", file: "a.tsx" },
      { id: "auth-check", title: "Auth Check", route: "/auth/check", kind: "page", framework: "nextjs-app", file: "b.tsx" },
      { id: "dashboard", title: "Dashboard", route: "/dashboard", kind: "page", framework: "nextjs-app", file: "c.tsx" },
    ];
    const apiMap: ApiMap = {};

    const nodes = buildGraphNodes(pages, apiMap);
    const q = "auth";
    const qLower = q.toLowerCase();

    // Simulate search: filter by name (as SearchEngine's Fuse would do)
    const matches = nodes.filter((n) => n.name.toLowerCase().includes(qLower) || n.summary.toLowerCase().includes(qLower));
    expect(matches.length).toBeGreaterThanOrEqual(1);

    // Map back to Page ids
    const pageIds = matches
      .filter((n) => n.type === "page")
      .map((n) => n.id.replace("page:", ""));
    expect(pageIds).toContain("auth-check");
  });
});
