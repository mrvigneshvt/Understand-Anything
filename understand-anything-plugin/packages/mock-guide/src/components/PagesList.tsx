"use client";

import { useEffect, useState } from "react";
import { getAccessToken } from "@/lib/token-gate";

interface PageInfo {
  id: string;
  title: string;
  route: string;
  mockStrategy?: string;
  kind?: string;
}

interface PagesListProps {
  currentPageId: string | null;
  onSelect: (pageId: string) => void;
}

export function PagesList({ currentPageId, onSelect }: PagesListProps) {
  const [pages, setPages] = useState<PageInfo[]>([]);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    const token = getAccessToken();
    fetch(`/api/mocks/manifest.json?token=${token}`)
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => {
        if (Array.isArray(data)) setPages(data);
        else if (data.pages) setPages(data.pages);
      })
      .catch(() => {});
  }, []);

  if (collapsed) {
    return (
      <button
        onClick={() => setCollapsed(false)}
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          bottom: 0,
          width: 24,
          border: "none",
          borderRight: "1px solid rgba(212,165,116,0.1)",
          backgroundColor: "var(--color-panel, #141414)",
          color: "var(--color-text-muted, #6b5f53)",
          cursor: "pointer",
          fontSize: 12,
          writingMode: "vertical-rl",
          textOrientation: "mixed",
          padding: "8px 4px",
        }}
      >
        Pages ({pages.length})
      </button>
    );
  }

  return (
    <div style={{
      width: 240,
      backgroundColor: "var(--color-panel, #141414)",
      borderRight: "1px solid rgba(212,165,116,0.1)",
      display: "flex",
      flexDirection: "column",
      height: "100%",
      position: "relative",
    }}>
      <div style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "10px 12px",
        borderBottom: "1px solid rgba(212,165,116,0.08)",
      }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: "var(--color-text-secondary, #a39787)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
          Pages ({pages.length})
        </span>
        <button
          onClick={() => setCollapsed(true)}
          style={{ background: "none", border: "none", color: "var(--color-text-muted, #6b5f53)", cursor: "pointer", fontSize: 14 }}
        >
          ◀
        </button>
      </div>
      <div style={{ flex: 1, overflow: "auto" }}>
        {pages.map((p) => {
          const isActive = p.id === currentPageId;
          return (
            <div
              key={p.id}
              onClick={() => onSelect(p.id)}
              style={{
                padding: "8px 12px",
                cursor: "pointer",
                backgroundColor: isActive ? "rgba(212,165,116,0.08)" : "transparent",
                borderLeft: isActive ? "2px solid var(--color-accent, #d4a574)" : "2px solid transparent",
                transition: "background 0.1s",
              }}
              onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.background = "rgba(255,255,255,0.03)"; }}
              onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.background = "transparent"; }}
            >
              <div style={{ fontSize: 13, color: "var(--color-text-primary, #f5f0eb)", marginBottom: 2 }}>
                {p.title}
              </div>
              <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                <span style={{
                  fontSize: 10,
                  padding: "1px 4px",
                  borderRadius: 2,
                  backgroundColor: p.mockStrategy === "structural" ? "rgba(90,158,111,0.2)" : "rgba(90,158,111,0.1)",
                  color: p.mockStrategy === "structural" ? "#5a9e6f" : "#5a9e6f",
                }}>
                  {p.mockStrategy ?? "structural"}
                </span>
                <span style={{ fontSize: 10, color: "var(--color-text-muted, #6b5f53)" }}>
                  {p.route}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
