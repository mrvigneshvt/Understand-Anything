import { NextRequest, NextResponse } from "next/server";
import { checkToken, handleApiError } from "@/lib/api-utils";

const MAX_INPUT_LENGTH = 2000;

export async function POST(request: NextRequest) {
  const tokenResponse = checkToken(request);
  if (tokenResponse) return tokenResponse;

  try {
    const body = await request.json().catch(() => ({}));
    const { nodeId, question, file, line, snippet } = body as {
      nodeId?: string;
      question?: string;
      file?: string;
      line?: number;
      snippet?: string;
    };

    // Input validation
    if (!question || typeof question !== "string" || question.trim().length === 0) {
      return NextResponse.json({ error: "Question is required" }, { status: 400 });
    }
    if (question.length > MAX_INPUT_LENGTH) {
      return NextResponse.json({ error: "Question too long" }, { status: 400 });
    }

    const sanitizedQuestion = question.trim().slice(0, MAX_INPUT_LENGTH);

    // Generate a mock response (no LLM call in deterministic mode)
    const explanation = [
      `Regarding "${sanitizedQuestion}"`,
      `File: ${file ?? "unknown"}:${line ?? 0}`,
      `Node: ${nodeId ?? "unknown"}`,
      snippet ? `Context: ${snippet.slice(0, 200)}` : "",
      "",
      "This is a placeholder explanation. The LLM integration will stream a real response.",
    ]
      .filter(Boolean)
      .join("\n");

    return NextResponse.json({
      nodeId: nodeId ?? null,
      explanation,
    });
  } catch (e) {
    return handleApiError(e);
  }
}
