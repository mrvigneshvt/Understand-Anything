import { describe, it, expect } from "vitest";
import path from "node:path";
import fs from "node:fs";
import { detectPages } from "./page-detector.mjs";
import { renderTemplates } from "./template-renderer.mjs";

const FIXTURE_DIR = path.resolve(__dirname, "../../../tests/fixtures/nextjs-app");

function setupInputs() {
  const pagesResult = detectPages(FIXTURE_DIR);
  const pagesPath = path.join(FIXTURE_DIR, ".ua", "mock-guide", "pages.json");
  fs.mkdirSync(path.dirname(pagesPath), { recursive: true });
  fs.writeFileSync(pagesPath, JSON.stringify(pagesResult, null, 2), "utf-8");
}

describe("template mode", () => {
  it("produces template mocks from pages.json", () => {
    setupInputs();
    const result = renderTemplates(FIXTURE_DIR);
    expect(result.mocks).toBeGreaterThanOrEqual(5);
    expect(result.templates).toBe(6);
  });

  it("emits mocks that import a template + MockDataProvider", () => {
    setupInputs();
    // Clean mocks dir so we only see template-renderer output
    const mocksDir = path.join(FIXTURE_DIR, ".ua", "mock-guide", "mocks");
    fs.rmSync(mocksDir, { recursive: true, force: true });
    fs.mkdirSync(mocksDir, { recursive: true });
    renderTemplates(FIXTURE_DIR);

    const files = fs.readdirSync(mocksDir).filter((f) => f.endsWith(".tsx"));
    expect(files.length).toBeGreaterThanOrEqual(5);

    for (const f of files) {
      const content = fs.readFileSync(path.join(mocksDir, f), "utf-8");
      expect(content).toContain("Template");
      expect(content).toContain("MockDataProvider");
      expect(content).toContain("seedData");
      expect(content).toContain("copyData");
    }
  });

  it("--no-llm uses heuristic mapping exclusively", () => {
    setupInputs();
    const result = renderTemplates(FIXTURE_DIR, { noLlm: true });
    expect(result.mocks).toBeGreaterThanOrEqual(5);
  });

  it("each template file exports a component at packages/mock-guide/src/templates/", () => {
    const templatesDir = path.resolve(__dirname, "../../../packages/mock-guide/src/templates");
    const files = fs.readdirSync(templatesDir).filter((f) => f.endsWith(".tsx"));
    expect(files.length).toBe(6);

    const expected = ["Login", "List", "Detail", "Form", "Dashboard", "Settings"];
    for (const name of expected) {
      const content = fs.readFileSync(path.join(templatesDir, `${name}.tsx`), "utf-8");
      expect(content).toContain("export function");
      expect(content).toContain("seed");
      expect(content).toContain("data-ua-binding");
    }
  });
});
