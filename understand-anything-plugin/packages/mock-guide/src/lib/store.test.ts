import { describe, it, expect } from "vitest";
import { SearchEngine } from "@understand-anything/core/search";
import type { GraphNode } from "@understand-anything/core/types";

describe("@ua/core integration", () => {
  it("SearchEngine can be constructed and searches return results", () => {
    const nodes: GraphNode[] = [
      {
        id: "auth-login",
        type: "function",
        name: "login",
        filePath: "app/auth/login.ts",
        lineRange: [1, 50],
        summary: "Handles user authentication",
        tags: ["auth", "login"],
        complexity: "moderate",
      },
      {
        id: "auth-logout",
        type: "function",
        name: "logout",
        filePath: "app/auth/logout.ts",
        lineRange: [1, 20],
        summary: "Ends user session",
        tags: ["auth", "logout"],
        complexity: "simple",
      },
      {
        id: "home-page",
        type: "module",
        name: "HomePage",
        filePath: "app/page.tsx",
        lineRange: [1, 100],
        summary: "Main landing page component",
        tags: ["ui", "home"],
        complexity: "simple",
      },
    ];

    const engine = new SearchEngine(nodes);
    const results = engine.search("auth");

    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results[0]?.nodeId).toBeDefined();
    expect(results[0]!.score).toBeGreaterThanOrEqual(0);
  });

  it("SearchEngine returns empty for empty query", () => {
    const engine = new SearchEngine([]);
    expect(engine.search("")).toEqual([]);
    expect(engine.search("   ")).toEqual([]);
  });
});
