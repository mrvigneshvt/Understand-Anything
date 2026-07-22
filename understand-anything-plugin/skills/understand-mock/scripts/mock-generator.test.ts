import { describe, it, expect } from "vitest";
import path from "node:path";
import fs from "node:fs";
import { detectPages } from "./page-detector.mjs";
import { mapApiCalls } from "./api-mapper.mjs";
import { generateMocks } from "./mock-generator.mjs";

const FIXTURE_DIR = path.resolve(__dirname, "../../../tests/fixtures/nextjs-app");

function setupInputs() {
  const pagesResult = detectPages(FIXTURE_DIR);
  const pagesPath = path.join(FIXTURE_DIR, ".ua", "mock-guide", "pages.json");
  fs.mkdirSync(path.dirname(pagesPath), { recursive: true });
  fs.writeFileSync(pagesPath, JSON.stringify(pagesResult, null, 2), "utf-8");

  const apiResult = mapApiCalls(FIXTURE_DIR);
  const apiPath = path.join(FIXTURE_DIR, ".ua", "mock-guide", "api-map.json");
  fs.writeFileSync(apiPath, JSON.stringify(apiResult, null, 2), "utf-8");

  return { pagesResult, apiResult };
}

describe("mock-generator", () => {
  it("produces mocks and seeds from pages.json + api-map.json", () => {
    setupInputs();
    const result = generateMocks(FIXTURE_DIR);
    expect(result.mocks).toBeGreaterThanOrEqual(5);
    expect(result.seeds).toBeGreaterThanOrEqual(5);
  });

  it("emits seed/<pageId>.json files with realistic deterministic data", () => {
    setupInputs();
    generateMocks(FIXTURE_DIR);

    const seedsDir = path.join(FIXTURE_DIR, ".ua", "mock-guide", "seed");
    expect(fs.existsSync(seedsDir)).toBe(true);

    const files = fs.readdirSync(seedsDir);
    expect(files.length).toBeGreaterThanOrEqual(5);

    for (const f of files) {
      const content = JSON.parse(fs.readFileSync(path.join(seedsDir, f), "utf-8"));
      expect(content).toBeDefined();
      expect(typeof content).toBe("object");
    }
  });

  it("emits mocks/<pageId>.tsx files that are valid TSX", () => {
    setupInputs();
    generateMocks(FIXTURE_DIR);

    const mocksDir = path.join(FIXTURE_DIR, ".ua", "mock-guide", "mocks");
    expect(fs.existsSync(mocksDir)).toBe(true);

    const files = fs.readdirSync(mocksDir).filter((f) => f.endsWith(".tsx"));
    expect(files.length).toBeGreaterThanOrEqual(5);

    for (const f of files) {
      const content = fs.readFileSync(path.join(mocksDir, f), "utf-8");
      expect(content).toContain("MockDataProvider");
      expect(content).toContain("seedData");
    }
  });

  it("every seed/<pageId>.json is non-empty with type-appropriate fields", () => {
    setupInputs();
    generateMocks(FIXTURE_DIR);

    const seedsDir = path.join(FIXTURE_DIR, ".ua", "mock-guide", "seed");
    const files = fs.readdirSync(seedsDir).filter((f) => f.endsWith(".json"));

    for (const f of files) {
      const content = JSON.parse(fs.readFileSync(path.join(seedsDir, f), "utf-8"));
      const keys = Object.keys(content);
      expect(keys.length, `Seed ${f} must not be empty {}`).toBeGreaterThan(0);
    }

    // Login pages shape
    const loginSeed = JSON.parse(fs.readFileSync(path.join(seedsDir, "page-login.json"), "utf-8"));
    expect(loginSeed).toHaveProperty("email");
    expect(loginSeed).toHaveProperty("password");
    if (loginSeed.user) {
      expect(loginSeed.user).toHaveProperty("id");
      expect(loginSeed.user).toHaveProperty("email");
    }

    // List pages shape
    const usersSeed = JSON.parse(fs.readFileSync(path.join(seedsDir, "page-users.json"), "utf-8"));
    expect(usersSeed).toHaveProperty("items");
    expect(usersSeed).toHaveProperty("total");
    expect(Array.isArray(usersSeed.items)).toBe(true);
    expect(usersSeed.items.length).toBeGreaterThanOrEqual(3);

    const ordersSeed = JSON.parse(fs.readFileSync(path.join(seedsDir, "page-orders.json"), "utf-8"));
    expect(ordersSeed).toHaveProperty("items");
    expect(ordersSeed).toHaveProperty("total");
    expect(Array.isArray(ordersSeed.items)).toBe(true);

    // Detail pages shape
    const userDetailSeed = JSON.parse(fs.readFileSync(path.join(seedsDir, "page-users-id.json"), "utf-8"));
    expect(userDetailSeed).toHaveProperty("id");
    expect(userDetailSeed).toHaveProperty("name");
    expect(userDetailSeed).toHaveProperty("email");

    const orderDetailSeed = JSON.parse(fs.readFileSync(path.join(seedsDir, "page-orders-id.json"), "utf-8"));
    expect(orderDetailSeed).toHaveProperty("id");
    expect(orderDetailSeed).toHaveProperty("product");

    // Dashboard pages shape
    const dashboardSeed = JSON.parse(fs.readFileSync(path.join(seedsDir, "page-dashboard.json"), "utf-8"));
    expect(dashboardSeed).toHaveProperty("stats");
    expect(dashboardSeed).toHaveProperty("recentActivity");
    expect(Array.isArray(dashboardSeed.stats)).toBe(true);

    // Settings pages shape
    const settingsSeed = JSON.parse(fs.readFileSync(path.join(seedsDir, "page-settings.json"), "utf-8"));
    expect(settingsSeed).toHaveProperty("theme");
    expect(settingsSeed).toHaveProperty("notifications");

    // Form pages shape
    const formSeed = JSON.parse(fs.readFileSync(path.join(seedsDir, "page-users-new.json"), "utf-8"));
    expect(formSeed).toHaveProperty("fields");
    expect(formSeed).toHaveProperty("defaultRole");

    // Deterministic check: running twice produces the same output
    generateMocks(FIXTURE_DIR);
    for (const f of files) {
      const content1 = JSON.parse(fs.readFileSync(path.join(seedsDir, f), "utf-8"));
      // Re-run and check same
      generateMocks(FIXTURE_DIR);
      const content2 = JSON.parse(fs.readFileSync(path.join(seedsDir, f), "utf-8"));
      expect(JSON.stringify(content1)).toBe(JSON.stringify(content2));
    }
  });

  it("--no-llm produces mocks for EVERY page (no skips)", () => {
    const { pagesResult } = setupInputs();
    const result = generateMocks(FIXTURE_DIR, { noLlm: true });

    // All pages should have mocks
    const mocksDir = path.join(FIXTURE_DIR, ".ua", "mock-guide", "mocks");
    const totalPages = pagesResult.pages.length;
    expect(result.mocks).toBe(totalPages);
    expect(result.seeds).toBe(totalPages);

    // Every page.id has a corresponding .tsx file
    for (const page of pagesResult.pages) {
      const mockPath = path.join(mocksDir, `${page.id}.tsx`);
      expect(fs.existsSync(mockPath), `Missing mock for ${page.id}`).toBe(true);
    }
  });
});
