import { describe, it, expect } from "vitest";
import path from "node:path";
import fs from "node:fs";
import { detectPages } from "./page-detector.mjs";
import { mapApiCalls } from "./api-mapper.mjs";

const FIXTURE_DIR = path.resolve(__dirname, "../../../tests/fixtures/nextjs-app");

describe("api-mapper", () => {
  function setup() {
    // Run page-detector to get fresh pages.json
    const pagesResult = detectPages(FIXTURE_DIR);
    const pagesPath = path.join(FIXTURE_DIR, ".ua", "mock-guide", "pages.json");
    fs.mkdirSync(path.dirname(pagesPath), { recursive: true });
    fs.writeFileSync(pagesPath, JSON.stringify(pagesResult, null, 2), "utf-8");
    return pagesResult;
  }

  it("produces api-map.json matching the §8.2 Record<pageId, { calls, schemas }> shape", () => {
    setup();
    const result = mapApiCalls(FIXTURE_DIR);

    // Result is a Record keyed by pageId
    expect(result).not.toHaveProperty("framework");
    expect(result).not.toHaveProperty("calls");
    expect(typeof result).toBe("object");

    // Every page has an entry
    const pageIds = Object.keys(result);
    expect(pageIds.length).toBeGreaterThanOrEqual(10);

    for (const pageId of pageIds) {
      const entry = result[pageId];
      expect(entry).toHaveProperty("calls");
      expect(entry).toHaveProperty("schemas");
      expect(Array.isArray(entry.calls)).toBe(true);
      expect(Array.isArray(entry.schemas)).toBe(true);

      for (const call of entry.calls) {
        expect(call).toHaveProperty("id");
        expect(call).toHaveProperty("file");
        expect(call).toHaveProperty("line");
        expect(call).toHaveProperty("method");
        expect(call).toHaveProperty("endpoint");
        expect(call).toHaveProperty("authRequired");

        // method must be valid per §8.2
        expect(["GET", "POST", "PUT", "DELETE", "PATCH", "RPC", "INTERNAL"]).toContain(call.method);

        // authRequired is a boolean
        expect(typeof call.authRequired).toBe("boolean");

        // requestSchema/responseSchema are optional strings (schema names)
        if (call.requestSchema !== undefined) {
          expect(typeof call.requestSchema).toBe("string");
        }
        if (call.responseSchema !== undefined) {
          expect(typeof call.responseSchema).toBe("string");
        }

        // NOT present (removed per §8.2)
        expect(call).not.toHaveProperty("pageId");
        expect(call).not.toHaveProperty("hopDepth");
        expect(call).not.toHaveProperty("path");
      }

      for (const schema of entry.schemas) {
        expect(schema).toHaveProperty("name");
        expect(schema).toHaveProperty("file");
        expect(schema).toHaveProperty("line");
        expect(schema).toHaveProperty("kind");
        expect(schema).toHaveProperty("fields");

        expect(["type", "zod", "pydantic", "graphql", "interface", "class"]).toContain(schema.kind);
        expect(Array.isArray(schema.fields)).toBe(true);

        for (const field of schema.fields) {
          expect(field).toHaveProperty("name");
          expect(field).toHaveProperty("type");
          expect(field).toHaveProperty("optional");
          expect(typeof field.optional).toBe("boolean");
        }
      }
    }
  });

  it("every ApiCall.file + line points at a real source location", () => {
    setup();
    const result = mapApiCalls(FIXTURE_DIR);

    for (const pageId of Object.keys(result)) {
      for (const call of result[pageId].calls) {
        const fullPath = path.resolve(FIXTURE_DIR, call.file);
        expect(fs.existsSync(fullPath)).toBe(true);
        const lines = fs.readFileSync(fullPath, "utf-8").split("\n");
        expect(call.line).toBeGreaterThanOrEqual(1);
        expect(call.line).toBeLessThanOrEqual(lines.length);
      }
    }
  });

  it("pages with zero API calls have { calls: [], schemas: [] } entry (present, not omitted)", () => {
    setup();
    const pagesResult = detectPages(FIXTURE_DIR);
    const result = mapApiCalls(FIXTURE_DIR);

    // At least some pages have zero calls
    let pagesWithNoCalls = 0;
    for (const page of pagesResult.pages) {
      const entry = result[page.id];
      expect(entry).toBeDefined();
      expect(Array.isArray(entry.calls)).toBe(true);
      expect(Array.isArray(entry.schemas)).toBe(true);
      if (entry.calls.length === 0) pagesWithNoCalls++;
    }
    // Should have at least one page with zero calls (e.g. non-API pages)
    expect(pagesWithNoCalls).toBeGreaterThanOrEqual(1);
  });

  it("endpoint field uses 'endpoint' key (not 'path')", () => {
    setup();
    const result = mapApiCalls(FIXTURE_DIR);

    let foundEndpoint = false;
    for (const pageId of Object.keys(result)) {
      for (const call of result[pageId].calls) {
        expect(call).not.toHaveProperty("path");
        expect(call.endpoint).toBeTruthy();
        foundEndpoint = true;
      }
    }
    expect(foundEndpoint).toBe(true);
  });

  it("--no-llm produces valid api-map.json", () => {
    setup();
    const result = mapApiCalls(FIXTURE_DIR, { noLlm: true });

    const pageIds = Object.keys(result);
    expect(pageIds.length).toBeGreaterThanOrEqual(10);

    // All entries have correct shape
    for (const pageId of pageIds) {
      expect(result[pageId]).toHaveProperty("calls");
      expect(result[pageId]).toHaveProperty("schemas");
    }
  });

  it("total API calls match expected count for the fixture", () => {
    setup();
    const result = mapApiCalls(FIXTURE_DIR);

    let totalCalls = 0;
    for (const pageId of Object.keys(result)) {
      totalCalls += result[pageId].calls.length;
    }
    // The Next.js fixture has API calls in its pages
    expect(totalCalls).toBeGreaterThanOrEqual(5);
  });
});
