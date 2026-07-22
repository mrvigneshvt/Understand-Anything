import { NextRequest, NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";
import { checkToken, handleApiError } from "@/lib/api-utils";
import { normalizeGraphPath } from "@/lib/source-file";

const PROJECT_ROOT = process.env.MOCK_GUIDE_PROJECT_ROOT ?? process.cwd();
const UA_DIR = path.resolve(PROJECT_ROOT, ".ua", "mock-guide");

export async function GET(request: NextRequest) {
  const tokenResponse = checkToken(request);
  if (tokenResponse) return tokenResponse;

  try {
    const fileParam = request.nextUrl.searchParams.get("file")
      ?? decodeURIComponent((request.nextUrl.pathname.split("/").pop() ?? "").replace(/\.(tsx|json)$/, ""));

    // /api/mocks/manifest.json → serve pages.json
    if (fileParam === "manifest" || fileParam === "manifest.json") {
      const pagesPath = path.join(UA_DIR, "pages.json");
      if (!fs.existsSync(pagesPath)) {
        return NextResponse.json({ pages: [], message: "No pages.json found — run the skill first" });
      }
      const pagesData = JSON.parse(fs.readFileSync(pagesPath, "utf8"));
      const pages = Array.isArray(pagesData.pages) ? pagesData.pages : pagesData;
      return NextResponse.json({ pages });
    }

    // /api/mocks/api-map.json → serve api-map.json
    if (fileParam === "api-map" || fileParam === "api-map.json") {
      const apiPath = path.join(UA_DIR, "api-map.json");
      if (!fs.existsSync(apiPath)) {
        return NextResponse.json({});
      }
      const apiMap = JSON.parse(fs.readFileSync(apiPath, "utf8"));
      return NextResponse.json(apiMap);
    }

    // /api/mocks/<pageId>.tsx → serve mock source
    const safePath = normalizeGraphPath(fileParam, UA_DIR);
    if (!safePath) {
      return NextResponse.json({ error: "Invalid path" }, { status: 400 });
    }

    // Try mocks/<pageId>.tsx, then seed/<pageId>.json
    const mockPath = path.join(UA_DIR, "mocks", safePath.endsWith(".tsx") ? safePath : `${safePath}.tsx`);
    const seedPath = path.join(UA_DIR, "seed", safePath.endsWith(".json") ? safePath : `${safePath}.json`);

    if (fs.existsSync(mockPath)) {
      const content = fs.readFileSync(mockPath, "utf8");
      return new NextResponse(content, {
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      });
    }

    if (fs.existsSync(seedPath)) {
      const content = fs.readFileSync(seedPath, "utf8");
      return new NextResponse(content, {
        headers: { "Content-Type": "application/json" },
      });
    }

    return NextResponse.json({ error: "Mock not found" }, { status: 404 });
  } catch (e) {
    return handleApiError(e);
  }
}