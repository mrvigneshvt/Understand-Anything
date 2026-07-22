import { NextRequest, NextResponse } from "next/server";
import { getToken } from "@/lib/api-utils";

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");
  return NextResponse.json({
    expected: getToken(),
    received: token,
    match: token === getToken(),
  });
}
