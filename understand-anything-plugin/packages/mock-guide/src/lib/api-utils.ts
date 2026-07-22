import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";

// Use a module-level token shared across all route handlers via a global
const TOKEN_KEY = "__MOCK_GUIDE_ACCESS_TOKEN";
function getSharedToken(): string {
  const g = globalThis as Record<string, unknown>;
  if (!g[TOKEN_KEY]) {
    // In dev mode, globalThis may be re-evaluated; fall back to env var
    const envToken = process.env.MOCK_GUIDE_TOKEN;
    if (envToken) {
      g[TOKEN_KEY] = envToken;
    } else {
      const token = crypto.randomBytes(16).toString("hex");
      g[TOKEN_KEY] = token;
      // Also set env so dev reloads reuse it
      process.env.MOCK_GUIDE_TOKEN = token;
    }
  }
  return g[TOKEN_KEY] as string;
}

export function checkToken(request: NextRequest): NextResponse | null {
  const token = request.nextUrl.searchParams.get("token");
  if (!token || token !== getSharedToken()) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return null;
}

export function getToken(): string {
  return getSharedToken();
}

export function handleApiError(error: unknown): NextResponse {
  const message = error instanceof Error ? error.message : String(error);
  // No secret logging, no internal error leakage
  console.error("[api]", message);
  return NextResponse.json({ error: "An unexpected error occurred" }, { status: 500 });
}

// Print startup URL once on first module load
let _startupLogged = false;
if (!_startupLogged) {
  _startupLogged = true;
  setTimeout(() => {
    console.log(`\n  Mock guide ready at http://127.0.0.1:5174/?token=${getSharedToken()}\n`);
  }, 100);
}
