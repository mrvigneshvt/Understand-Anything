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

    const annotationPath = path.join(UA_DIR, "annotations", safePath.endsWith(".json") ? safePath : `${safePath}.json`);

    if (!fs.existsSync(annotationPath)) {
      return NextResponse.json({ error: "Annotation not found" }, { status: 404 });
    }

    const content = fs.readFileSync(annotationPath, "utf8");
    const data = JSON.parse(content);
    return NextResponse.json(data);
  } catch (e) {
    return handleApiError(e);
  }
}