"use client";

import { useState } from "react";
import { getAccessToken } from "@/lib/token-gate";
import { useStore } from "@/lib/store";

interface LlmExplainProps {
  nodeId: string;
  file: string;
  line: number;
  snippet?: string;
}

export function LlmExplain({ nodeId, file, line, snippet }: LlmExplainProps) {
  const [question, setQuestion] = useState("");
  const [response, setResponse] = useState("");
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const { noLlm } = useStore();

  if (noLlm) {
    return (
      <span style={{ fontSize: 10, color: "var(--color-text-muted, #6b5f53)", cursor: "help" }} title="Requires LLM">
        Ask LLM (disabled)
      </span>
    );
  }

  const handleAsk = async () => {
    if (!question.trim()) return;
    setLoading(true);
    setResponse("");

    const token = getAccessToken();
    try {
      const res = await fetch(`/api/llm-explain?token=${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nodeId, question, file, line, snippet }),
      });
      const data = await res.json();
      setResponse(data.explanation ?? "No response");
    } catch {
      setResponse("Error fetching explanation");
    }
    setLoading(false);
  };

  return (
    <div style={{ marginTop: 4 }}>
      <button
        onClick={() => setExpanded(!expanded)}
        style={{
          background: "none",
          border: "none",
          color: "var(--color-accent, #d4a574)",
          cursor: "pointer",
          fontSize: 11,
          padding: 0,
        }}
      >
        {expanded ? "Hide" : "Ask LLM"}
      </button>
      {expanded && (
        <div style={{ marginTop: 4 }}>
          <input
            type="text"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Ask about this node..."
            style={{
              width: "100%",
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(212,165,116,0.2)",
              borderRadius: 4,
              padding: "4px 8px",
              fontSize: 11,
              color: "var(--color-text-primary, #f5f0eb)",
            }}
          />
          <button
            onClick={handleAsk}
            disabled={loading || !question.trim()}
            style={{
              marginTop: 4,
              background: loading ? "rgba(212,165,116,0.2)" : "var(--color-accent, #d4a574)",
              border: "none",
              borderRadius: 4,
              padding: "2px 8px",
              fontSize: 10,
              color: loading ? "var(--color-text-muted)" : "#000",
              cursor: loading ? "default" : "pointer",
            }}
          >
            {loading ? "..." : "Ask"}
          </button>
          {response && (
            <p style={{ fontSize: 11, color: "var(--color-text-secondary, #a39787)", marginTop: 4 }}>
              {response}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
