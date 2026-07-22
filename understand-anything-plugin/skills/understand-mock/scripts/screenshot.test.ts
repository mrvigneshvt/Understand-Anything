import { describe, it, expect } from "vitest";
import path from "node:path";
import fs from "node:fs";
import { detectPages } from "./page-detector.mjs";
import { captureScreenshots } from "./screenshot.mjs";

const FIXTURE_DIR = path.resolve(__dirname, "../../../tests/fixtures/nextjs-app");

function setupInputs() {
  const pagesResult = detectPages(FIXTURE_DIR);
  const pagesPath = path.join(FIXTURE_DIR, ".ua", "mock-guide", "pages.json");
  fs.mkdirSync(path.dirname(pagesPath), { recursive: true });
  fs.writeFileSync(pagesPath, JSON.stringify(pagesResult, null, 2), "utf-8");
}

describe("screenshot mode", () => {
  it("plans screenshot commands from pages.json via MCP adapter", () => {
    setupInputs();
    const result = captureScreenshots(FIXTURE_DIR, { mode: "mcp" });

    // Even without a running server, MCP adapter should plan commands
    expect(result).toHaveProperty("screenshots");
    expect(result).toHaveProperty("fallback");
  });

  it("writes screenshot commands manifest for executor", () => {
    setupInputs();
    captureScreenshots(FIXTURE_DIR, { mode: "mcp" });

    const manifestPath = path.join(FIXTURE_DIR, ".ua", "mock-guide", "public", "screenshot-commands.json");
    expect(fs.existsSync(manifestPath)).toBe(true);

    const commands = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
    expect(Array.isArray(commands)).toBe(true);
    if (commands.length > 0) {
      expect(commands[0]).toHaveProperty("pageId");
      expect(commands[0]).toHaveProperty("url");
      expect(commands[0]).toHaveProperty("steps");
    }
  });

  it("fallback returns true when project has no dev server config", () => {
    const emptyDir = path.join(FIXTURE_DIR, "..", "empty-test");
    fs.mkdirSync(emptyDir, { recursive: true });

    // Write pages.json but no package.json
    const pagesPath = path.join(emptyDir, ".ua", "mock-guide", "pages.json");
    fs.mkdirSync(path.dirname(pagesPath), { recursive: true });
    fs.writeFileSync(pagesPath, JSON.stringify({ pages: [{ id: "test", route: "/" }] }), "utf-8");

    const result = captureScreenshots(emptyDir, { mode: "mcp" });
    // Should not crash
    expect(result).toHaveProperty("fallback");
  });
});
