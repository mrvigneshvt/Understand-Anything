import { describe, it, expect } from "vitest";
import path from "node:path";
import fs from "node:fs";
import { detectPages } from "./page-detector.mjs";
import { mapApiCalls } from "./api-mapper.mjs";
import { buildAnnotations } from "./annotation-builder.mjs";

const FIXTURE_DIR = path.resolve(__dirname, "../../../tests/fixtures/nextjs-app");

function setupInputs() {
  // Run C1 + C2 to produce input files
  const pagesResult = detectPages(FIXTURE_DIR);
  const pagesPath = path.join(FIXTURE_DIR, ".ua", "mock-guide", "pages.json");
  fs.mkdirSync(path.dirname(pagesPath), { recursive: true });
  fs.writeFileSync(pagesPath, JSON.stringify(pagesResult, null, 2), "utf-8");

  const apiResult = mapApiCalls(FIXTURE_DIR);
  const apiPath = path.join(FIXTURE_DIR, ".ua", "mock-guide", "api-map.json");
  fs.writeFileSync(apiPath, JSON.stringify(apiResult, null, 2), "utf-8");

  return { pagesResult, apiResult };
}

describe("annotation-builder", () => {
  it("produces annotation files from pages.json + api-map.json", () => {
    setupInputs();
    const result = buildAnnotations(FIXTURE_DIR);
    expect(result.length).toBeGreaterThanOrEqual(5);
  });

  it("every AnnotationNode.file exists on disk and line is within valid range", () => {
    setupInputs();
    const result = buildAnnotations(FIXTURE_DIR);

    for (const ann of result) {
      for (const node of flattenNodes(ann.nodes)) {
        const fullPath = path.resolve(FIXTURE_DIR, node.file);
        expect(fs.existsSync(fullPath), `File not found: ${node.file}`).toBe(true);
        const lineCount = fs.readFileSync(fullPath, "utf-8").split("\n").length;
        expect(node.line, `Line ${node.line} out of range in ${node.file} (${lineCount} lines)`).toBeGreaterThanOrEqual(1);
        expect(node.line, `Line ${node.line} exceeds ${lineCount} in ${node.file}`).toBeLessThanOrEqual(lineCount);
      }
    }
  });

  it("annotation files match §8.3 shape", () => {
    setupInputs();
    const result = buildAnnotations(FIXTURE_DIR);

    for (const ann of result) {
      expect(ann).toHaveProperty("pageId");
      expect(ann).toHaveProperty("pageName");
      expect(ann).toHaveProperty("pageRoute");
      expect(ann).toHaveProperty("nodes");
      expect(Array.isArray(ann.nodes)).toBe(true);

      for (const node of flattenNodes(ann.nodes)) {
        expect(node).toHaveProperty("id");
        expect(node).toHaveProperty("label");
        expect(node).toHaveProperty("kind");
        expect(node).toHaveProperty("file");
        expect(node).toHaveProperty("line");
        expect(["ui", "hook", "store", "fetch", "server", "service", "model", "type", "controller"]).toContain(node.kind);

        // snippet should be present and non-empty
        expect(node).toHaveProperty("snippet");
        expect(typeof node.snippet).toBe("string");
        expect(node.snippet.length).toBeGreaterThan(0);
      }

      // uiBindings is optional; when present, it's string[] per §8.3
      if (ann.uiBindings) {
        expect(Array.isArray(ann.uiBindings)).toBe(true);
        for (const b of ann.uiBindings) {
          expect(typeof b).toBe("string");
        }
      }
    }
  });

  it("--no-llm produces valid annotation files", () => {
    setupInputs();
    const result = buildAnnotations(FIXTURE_DIR, { noLlm: true });
    expect(result.length).toBeGreaterThanOrEqual(5);
    for (const ann of result) {
      expect(ann).toHaveProperty("nodes");
    }
  });
});

function flattenNodes(nodes) {
  const result = [];
  function walk(ns) {
    for (const n of ns) {
      result.push(n);
      if (n.children) walk(n.children);
    }
  }
  walk(nodes);
  return result;
}
