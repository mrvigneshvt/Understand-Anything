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
      ?? decodeURIComponent(request.nextUrl.pathname.split("/").pop() ?? "");

    const safePath = normalizeGraphPath(fileParam, UA_DIR);
    if (!safePath) {
      return NextResponse.json({ error: "Invalid path" }, { status: 400 });
    }

    const seedPath = path.join(UA_DIR, "seed", safePath.endsWith(".json") ? safePath : `${safePath}.json`);

    if (!fs.existsSync(seedPath)) {
      return NextResponse.json({ error: "Seed not found" }, { status: 404 });
    }

    const content = fs.readFileSync(seedPath, "utf8");
    const data = JSON.parse(content);
    return NextResponse.json(data);
  } catch (e) {
    return handleApiError(e);
  }
}