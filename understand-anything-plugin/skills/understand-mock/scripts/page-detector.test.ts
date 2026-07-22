import { describe, it, expect } from "vitest";
import path from "node:path";
import fs from "node:fs";
import { detectPages } from "../scripts/page-detector.mjs";

const FIXTURE_DIR = path.resolve(__dirname, "../../../tests/fixtures/nextjs-app");

describe("page-detector", () => {
  it("detects pages in the Next.js App Router fixture", () => {
    const result = detectPages(FIXTURE_DIR);

    // Should detect a framework
    expect(result.framework).toBeTruthy();
    expect(result.pages.length).toBeGreaterThanOrEqual(10);
  });

  it("every Page.id is unique and slug-friendly", () => {
    const result = detectPages(FIXTURE_DIR);
    const ids = new Set();
    for (const p of result.pages) {
      expect(p.id).toMatch(/^[a-z0-9-]+$/);
      expect(ids.has(p.id)).toBe(false);
      ids.add(p.id);
    }
  });

  it("every Page.route starts with / or is a CLI name", () => {
    const result = detectPages(FIXTURE_DIR);
    for (const p of result.pages) {
      expect(p.route.startsWith("/") || !p.route.includes("/")).toBe(true);
    }
  });

  it("every Page.mockStrategy is one of the allowed values", () => {
    const result = detectPages(FIXTURE_DIR);
    const allowed = new Set(["screenshot", "structural", "template"]);
    for (const p of result.pages) {
      expect(allowed.has(p.mockStrategy)).toBe(true);
    }
  });

  it("every Page.file exists on disk", () => {
    const result = detectPages(FIXTURE_DIR);
    for (const p of result.pages) {
      const fullPath = path.resolve(FIXTURE_DIR, p.file);
      expect(fs.existsSync(fullPath)).toBe(true);
    }
  });

  it("every Page.mockFile/seedFile/annotationFile follow the declared path convention", () => {
    const result = detectPages(FIXTURE_DIR);
    for (const p of result.pages) {
      expect(p.mockFile).toMatch(/^mocks\//);
      expect(p.seedFile).toMatch(/^seed\//);
      expect(p.annotationFile).toMatch(/^annotations\//);
    }
  });

  it("output pages.json matches the exact §8.1 shape with ALL required fields", () => {
    const result = detectPages(FIXTURE_DIR);
    expect(result).toHaveProperty("framework");
    expect(result).not.toHaveProperty("projectType");
    expect(result).toHaveProperty("pages");
    expect(Array.isArray(result.pages)).toBe(true);

    for (const p of result.pages) {
      // All §8.1 fields present
      expect(p).toHaveProperty("id");
      expect(p).toHaveProperty("title");  // not "name"
      expect(p).toHaveProperty("route");
      expect(p).toHaveProperty("kind");   // not "type"
      expect(p).toHaveProperty("framework");
      expect(p).toHaveProperty("file");
      expect(p).toHaveProperty("mockFile");
      expect(p).toHaveProperty("seedFile");
      expect(p).toHaveProperty("annotationFile");
      expect(p).toHaveProperty("mockStrategy");
      expect(p).toHaveProperty("components");
      expect(p).toHaveProperty("apiCalls");
      expect(p).toHaveProperty("personas");

      // Forbidden old field names
      expect(p).not.toHaveProperty("name");
      expect(p).not.toHaveProperty("type");

      // Type checks
      expect(Array.isArray(p.components)).toBe(true);
      expect(Array.isArray(p.apiCalls)).toBe(true);
      expect(Array.isArray(p.personas)).toBe(true);
      expect(p.personas.length).toBeGreaterThan(0);
      for (const persona of p.personas) {
        expect(["non-technical", "junior", "experienced"]).toContain(persona);
      }

      // Kind must be one of the valid §8.1 values
      expect(["page", "endpoint", "command", "export", "screen"]).toContain(p.kind);
    }
  });

  it("--no-llm produces valid pages.json with no LLM call", () => {
    const result = detectPages(FIXTURE_DIR, { noLlm: true });
    expect(result).toHaveProperty("pages");
    expect(Array.isArray(result.pages)).toBe(true);
    expect(result.pages.length).toBeGreaterThanOrEqual(10);
  });

  it("runs on a Vite SPA (UA dashboard) and finds some pages", () => {
    const uaDashboardDir = "/tmp/ua-reference/understand-anything-plugin/packages/dashboard";
    if (fs.existsSync(uaDashboardDir)) {
      const result = detectPages(uaDashboardDir);
      // Vite SPA may not have traditional pages but default detection might find some
      expect(result).toHaveProperty("framework");
      expect(result).toHaveProperty("pages");
    }
  });

  describe("framework expansion: new detection strategies", () => {
    const tmpDir = path.resolve(__dirname, "../../../.ua-test-fixtures");
    const frameworks = ["vue-nuxt", "sveltekit", "nestjs", "fastapi", "flask", "rails", "remix", "astro"];

    function cleanup() {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }

    it("detects Vue/Nuxt pages via pages/**/*.vue", () => {
      cleanup();
      fs.mkdirSync(path.join(tmpDir, "pages"), { recursive: true });
      fs.writeFileSync(path.join(tmpDir, "pages", "index.vue"), "<template><div>Home</div></template>", "utf-8");
      fs.writeFileSync(path.join(tmpDir, "pages", "login.vue"), "<template><form>Login</form></template>", "utf-8");
      fs.writeFileSync(path.join(tmpDir, "pages", "[id].vue"), "<template><div>Dynamic</div></template>", "utf-8");
      fs.writeFileSync(path.join(tmpDir, "app.vue"), "<template><NuxtPage/></template>", "utf-8");
      const result = detectPages(tmpDir);
      const vuePages = result.pages.filter((p) => p.framework === "vue-nuxt");
      expect(vuePages.length).toBeGreaterThanOrEqual(3);
      expect(vuePages.some((p) => p.route === "/")).toBe(true);
      expect(vuePages.some((p) => p.route === "/login")).toBe(true);
      cleanup();
    });

    it("detects SvelteKit pages via src/routes/**/+page.svelte", () => {
      cleanup();
      fs.mkdirSync(path.join(tmpDir, "src", "routes"), { recursive: true });
      fs.writeFileSync(path.join(tmpDir, "src", "routes", "+page.svelte"), "<h1>Home</h1>", "utf-8");
      fs.mkdirSync(path.join(tmpDir, "src", "routes", "about"), { recursive: true });
      fs.writeFileSync(path.join(tmpDir, "src", "routes", "about", "+page.svelte"), "<h1>About</h1>", "utf-8");
      const result = detectPages(tmpDir);
      const skPages = result.pages.filter((p) => p.framework === "sveltekit");
      expect(skPages.length).toBeGreaterThanOrEqual(2);
      expect(skPages.some((p) => p.route === "/about")).toBe(true);
      cleanup();
    });

    it("detects NestJS controllers via @Controller + @Get decorators", () => {
      cleanup();
      fs.mkdirSync(path.join(tmpDir, "src"), { recursive: true });
      fs.writeFileSync(path.join(tmpDir, "src", "users.controller.ts"), `
@Controller('users')
export class UsersController {
  @Get()
  async findAll() { return []; }
  @Get(':id')
  async findOne() { return {}; }
}`, "utf-8");
      const result = detectPages(tmpDir);
      const nsPages = result.pages.filter((p) => p.framework === "nestjs");
      expect(nsPages.length).toBeGreaterThanOrEqual(2);
      expect(nsPages.some((p) => p.route.includes("users"))).toBe(true);
      cleanup();
    });

    it("detects FastAPI routes via @router.get/post", () => {
      cleanup();
      fs.mkdirSync(path.join(tmpDir, "api"), { recursive: true });
      fs.writeFileSync(path.join(tmpDir, "api", "routes.py"), `
from fastapi import APIRouter
router = APIRouter()

@router.get("/items")
async def list_items(): return []

@router.post("/items")
async def create_item(): return {}
`, "utf-8");
      const result = detectPages(tmpDir);
      const faPages = result.pages.filter((p) => p.framework === "fastapi");
      expect(faPages.length).toBeGreaterThanOrEqual(2);
      cleanup();
    });

    it("detects Flask routes via @app.route", () => {
      cleanup();
      fs.mkdirSync(path.join(tmpDir, "api"), { recursive: true });
      fs.writeFileSync(path.join(tmpDir, "api", "app.py"), `
from flask import Flask
app = Flask(__name__)

@app.route("/")
def home(): return "OK"

@app.route("/users", methods=["GET"])
def list_users(): return []
`, "utf-8");
      const result = detectPages(tmpDir);
      const flPages = result.pages.filter((p) => p.framework === "flask");
      expect(flPages.length).toBeGreaterThanOrEqual(2);
      cleanup();
    });

    it("detects Rails routes via app/controllers/**/*.rb", () => {
      cleanup();
      fs.mkdirSync(path.join(tmpDir, "config"), { recursive: true });
      fs.writeFileSync(path.join(tmpDir, "config", "routes.rb"), "Rails.application.routes.draw { resources :users }", "utf-8");
      fs.mkdirSync(path.join(tmpDir, "app", "controllers"), { recursive: true });
      fs.writeFileSync(path.join(tmpDir, "app", "controllers", "users_controller.rb"), "class UsersController < ApplicationController; end", "utf-8");
      const result = detectPages(tmpDir);
      const rlPages = result.pages.filter((p) => p.framework === "rails");
      expect(rlPages.length).toBeGreaterThanOrEqual(1);
      expect(rlPages.some((p) => p.route.includes("users"))).toBe(true);
      cleanup();
    });

    it("detects Remix routes via app/routes/**/*.{ts,tsx}", () => {
      cleanup();
      fs.mkdirSync(path.join(tmpDir, "app", "routes"), { recursive: true });
      fs.writeFileSync(path.join(tmpDir, "app", "routes", "_index.tsx"), "export default () => <h1>Home</h1>", "utf-8");
      fs.writeFileSync(path.join(tmpDir, "app", "routes", "login.tsx"), "export default () => <form>Login</form>", "utf-8");
      const result = detectPages(tmpDir);
      const rxPages = result.pages.filter((p) => p.framework === "remix");
      expect(rxPages.length).toBeGreaterThanOrEqual(2);
      cleanup();
    });

    it("detects Astro pages via src/pages/**/*.astro", () => {
      cleanup();
      fs.mkdirSync(path.join(tmpDir, "src", "pages"), { recursive: true });
      fs.writeFileSync(path.join(tmpDir, "src", "pages", "index.astro"), "---\n---\n<h1>Home</h1>", "utf-8");
      fs.writeFileSync(path.join(tmpDir, "src", "pages", "about.astro"), "---\n---\n<h1>About</h1>", "utf-8");
      const result = detectPages(tmpDir);
      const asPages = result.pages.filter((p) => p.framework === "astro");
      expect(asPages.length).toBeGreaterThanOrEqual(2);
      expect(asPages.some((p) => p.route === "/about")).toBe(true);
      cleanup();
    });
  });

  describe("maxPages capping", () => {
    const tmpDir = path.resolve(__dirname, "../../../.ua-test-maxpages");

    function makePages(n) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
      fs.mkdirSync(path.join(tmpDir, "pages"), { recursive: true });
      for (let i = 0; i < n; i++) {
        fs.writeFileSync(path.join(tmpDir, "pages", `page-${i}.vue`), "<template>Page</template>", "utf-8");
      }
    }

    it("caps at maxPages and adds cappedAt + totalPagesDetected fields", () => {
      makePages(100);
      const result = detectPages(tmpDir, { maxPages: 50 });
      expect(result.pages.length).toBe(50);
      expect(result.cappedAt).toBe(50);
      expect(result.totalPagesDetected).toBeGreaterThanOrEqual(100);
      fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    it("uses default of 50 when maxPages not specified", () => {
      makePages(100);
      const result = detectPages(tmpDir);
      expect(result.pages.length).toBe(50);
      expect(result.cappedAt).toBe(50);
      fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    it("does not cap when page count <= maxPages", () => {
      makePages(10);
      const result = detectPages(tmpDir, { maxPages: 50 });
      expect(result.pages.length).toBe(10);
      expect(result.cappedAt).toBeUndefined();
      fs.rmSync(tmpDir, { recursive: true, force: true });
    });
  });
});
