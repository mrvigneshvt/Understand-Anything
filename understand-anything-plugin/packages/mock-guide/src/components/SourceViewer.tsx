"use client";

import { useMemo, useState, useEffect } from "react";
import { getAccessToken } from "@/lib/token-gate";

interface SourceViewerProps {
  file: string;
  line: number;
  onClose: () => void;
}

const EXT_LANG: Record<string, string> = {
  ts: "typescript", tsx: "tsx", js: "javascript", jsx: "jsx",
  mjs: "javascript", py: "python", rb: "ruby", rs: "rust",
  go: "go", java: "java", css: "css", html: "markup",
  json: "json", yaml: "yaml", yml: "yaml", md: "markdown",
};

/** Minimal syntax highlighting (one pass, regex-based) */
function highlightLine(line: string, lang: string): string {
  let escaped = line
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  if (lang === "tsx" || lang === "typescript" || lang === "javascript") {
    // Strings
    escaped = escaped.replace(/(['"`])(?:(?!\1|\\).|\\.)*\1/g, '<span style="color:#a5d6ff">$&</span>');
    // Keywords
    escaped = escaped.replace(/\b(import|export|from|const|let|var|function|return|if|else|for|while|class|interface|type|new|async|await|yield|throw|try|catch|finally)\b/g, '<span style="color:#c586c0">$1</span>');
    // Types
    escaped = escaped.replace(/\b(string|number|boolean|void|never|any|unknown|null|undefined|Record|Partial|Required|Pick|Omit)\b/g, '<span style="color:#569cd6">$1</span>');
    // Decorators
    escaped = escaped.replace(/(@\w+)/g, '<span style="color:#dcdcaa">$1</span>');
    // Numbers
    escaped = escaped.replace(/\b(\d+\.?\d*)\b/g, '<span style="color:#b5cea8">$1</span>');
    // Comments
    escaped = escaped.replace(/(\/\/.*$)/g, '<span style="color:#6a9955">$1</span>');
  } else if (lang === "python") {
    escaped = escaped.replace(/(['"'])(?:(?!\1|\\).|\\.)*\1/g, '<span style="color:#a5d6ff">$&</span>');
    escaped = escaped.replace(/\b(def|class|import|from|return|if|else|elif|for|while|try|except|finally|with|as|yield|async|await)\b/g, '<span style="color:#c586c0">$1</span>');
    escaped = escaped.replace(/(#.*$)/g, '<span style="color:#6a9955">$1</span>');
  }

  return escaped;
}

export function SourceViewer({ file, line, onClose }: SourceViewerProps) {
  const [fetchedContent, setFetchedContent] = useState<string | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);

  useEffect(() => {
    setFetchedContent(null);
    setFetchError(null);
    const token = getAccessToken();
    fetch(`/api/source/${encodeURIComponent(file)}?token=${token}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.content) setFetchedContent(data.content);
        else setFetchError("Source not available");
      })
      .catch(() => setFetchError("Failed to load source"));
  }, [file, line]);

  const { lang } = useMemo(() => {
    const ext = file.split(".").pop() ?? "";
    const lang = EXT_LANG[ext] ?? "text";
    return { lang };
  }, [file]);

  const content = fetchedContent ?? `// ${file}:${line}\n// ${fetchError ?? "Loading..."}`;
  const lines = content.split("\n");
  const startLine = Math.max(1, line - 5);
  const endLine = Math.min(lines.length, line + 5);
  const contextLines = lines.slice(startLine - 1, endLine);

  return (
    <div style={{
      border: "1px solid rgba(212,165,116,0.15)",
      borderRadius: 6,
      overflow: "hidden",
      backgroundColor: "var(--color-surface, #111)",
    }}>
      <div style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "8px 12px",
        borderBottom: "1px solid rgba(212,165,116,0.1)",
        fontSize: 12,
      }}>
        <span style={{ color: "var(--color-text-secondary, #a39787)" }}>
          <strong>{file}</strong>
          <span style={{ marginLeft: 8, color: "var(--color-text-muted, #6b5f53)" }}>line {line}</span>
        </span>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={() => navigator.clipboard.writeText(`${file}:${line}`)}
            style={{ background: "none", border: "none", color: "var(--color-accent, #d4a574)", cursor: "pointer", fontSize: 12 }}
          >
            Copy path
          </button>
          <button
            onClick={onClose}
            style={{ background: "none", border: "none", color: "var(--color-text-muted, #6b5f53)", cursor: "pointer", fontSize: 12 }}
          >
            ✕
          </button>
        </div>
      </div>
      <pre style={{
        margin: 0,
        padding: "8px 12px",
        fontSize: 12,
        lineHeight: 1.5,
        fontFamily: "var(--font-jetbrains-mono, monospace)",
        overflow: "auto",
        maxHeight: 300,
      }}>
        {contextLines.map((l, i) => {
          const lineNum = startLine + i;
          const isActive = lineNum === line;
          return (
            <div
              key={lineNum}
              style={{
                display: "flex",
                backgroundColor: isActive ? "rgba(212,165,116,0.08)" : "transparent",
                borderLeft: isActive ? "2px solid var(--color-accent, #d4a574)" : "2px solid transparent",
              }}
            >
              <span style={{
                display: "inline-block",
                width: 40,
                textAlign: "right",
                paddingRight: 12,
                color: "var(--color-text-muted, #6b5f53)",
                userSelect: "none",
                opacity: isActive ? 1 : 0.6,
              }}>
                {lineNum}
              </span>
              <span
                dangerouslySetInnerHTML={{ __html: highlightLine(l, lang) }}
                style={{ whiteSpace: "pre" }}
              />
            </div>
          );
        })}
      </pre>
    </div>
  );
}
