import { NextRequest, NextResponse } from "next/server";
import { checkToken, handleApiError } from "@/lib/api-utils";
import { readSourceFile } from "@/lib/source-file";

const PROJECT_ROOT = process.env.MOCK_GUIDE_PROJECT_ROOT ?? process.cwd();

export async function GET(request: NextRequest) {
  const tokenResponse = checkToken(request);
  if (tokenResponse) return tokenResponse;

  try {
    const fileParam = request.nextUrl.searchParams.get("file")
      ?? decodeURIComponent(request.nextUrl.pathname.split("/").pop() ?? "");

    if (!fileParam) {
      return NextResponse.json({ error: "Missing file parameter" }, { status: 400 });
    }

    const result = readSourceFile(fileParam, PROJECT_ROOT);
    return NextResponse.json(result.payload, { status: result.statusCode });
  } catch (e) {
    return handleApiError(e);
  }
}