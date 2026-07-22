"use client";

import { lazy, Suspense, useEffect, useState, useRef, useCallback, Component, type ReactNode } from "react";
import { getAccessToken } from "@/lib/token-gate";
import { useStore } from "@/lib/store";

interface MockFrameProps {
  pageId: string | null;
}

class ErrorBoundary extends Component<{ children: ReactNode; fallback: (error: Error) => ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  render() {
    if (this.state.error) return this.props.fallback(this.state.error);
    return this.props.children;
  }
}

export function MockFrame({ pageId }: MockFrameProps) {
  const [mockSrc, setMockSrc] = useState<string | null>(null);
  const [seed, setSeed] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [liveFailed, setLiveFailed] = useState(false);
  const [MockComponent, setMockComponent] = useState<React.ComponentType | null>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const bindingHover = useStore((s) => s.bindingHover);
  const setBindingSelect = useStore((s) => s.setBindingSelect);

  // Apply CSS glow to elements with matching data-ua-binding
  useEffect(() => {
    if (!frameRef.current) return;
    const root = frameRef.current;
    const all = root.querySelectorAll<HTMLElement>("[data-ua-binding]");
    all.forEach((el) => {
      const binding = el.getAttribute("data-ua-binding");
      if (binding && bindingHover && binding === bindingHover) {
        el.style.boxShadow = "0 0 0 2px var(--color-accent, #d4a574)";
        el.style.outline = "2px solid var(--color-accent, #d4a574)";
        el.style.outlineOffset = "2px";
      } else {
        el.style.boxShadow = "";
        el.style.outline = "";
        el.style.outlineOffset = "";
      }
    });
  }, [bindingHover]);

  // Handle clicks on data-ua-binding elements -> highlight call chain node
  const handleMockClick = useCallback((e: MouseEvent) => {
    const target = e.target as HTMLElement;
    const bindingEl = target.closest<HTMLElement>("[data-ua-binding]");
    if (bindingEl) {
      const binding = bindingEl.getAttribute("data-ua-binding");
      if (binding) {
        setBindingSelect(binding);
      }
    }
  }, [setBindingSelect]);

  useEffect(() => {
    if (!frameRef.current) return;
    const root = frameRef.current;
    root.addEventListener("click", handleMockClick);
    return () => root.removeEventListener("click", handleMockClick);
  }, [handleMockClick]);

  useEffect(() => {
    if (!pageId) return;
    setLoading(true);
    setError(null);
    setMockSrc(null);
    setSeed(null);
    setLiveFailed(false);
    setMockComponent(null);

    const token = getAccessToken();

    fetch(`/api/mocks/${encodeURIComponent(pageId)}.tsx?token=${token}`)
      .then((res) => {
        if (!res.ok) throw new Error(`Mock not found (${res.status})`);
        return res.text();
      })
      .then((src) => { setMockSrc(src); setLoading(false); })
      .catch((e) => { setError(e.message); setLoading(false); });

    fetch(`/api/seed/${encodeURIComponent(pageId)}.json?token=${token}`)
      .then((res) => res.ok ? res.json() : null)
      .then((data) => data && setSeed(data))
      .catch(() => {});

    try {
      const LiveComponent = lazy(() => import(`@/mocks/generated/${pageId}`));
      setMockComponent(() => LiveComponent);
    } catch {
      setLiveFailed(true);
    }
  }, [pageId]);

  if (!pageId) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "var(--color-text-muted, #6b5f53)" }}>
        Select a page
      </div>
    );
  }

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "var(--color-text-muted, #6b5f53)" }}>
        Loading mock...
      </div>
    );
  }

  if (error && !mockSrc) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "var(--color-text-muted, #6b5f53)", flexDirection: "column", gap: 8 }}>
        <span>{error}</span>
        <span style={{ fontSize: 11, fontFamily: "var(--font-jetbrains-mono, monospace)" }}>
          Run the skill to generate mocks at .ua/mock-guide/mocks/{pageId}.tsx
        </span>
      </div>
    );
  }

  const showLive = MockComponent && !liveFailed;

  return (
    <div ref={frameRef} style={{ height: "100%", display: "flex", flexDirection: "column", gap: 8 }} data-testid="mock-frame">
      {showLive && (
        <div style={{
          alignSelf: "flex-start",
          padding: "2px 8px",
          fontSize: 10,
          fontWeight: 600,
          textTransform: "uppercase",
          letterSpacing: "0.05em",
          borderRadius: 3,
          background: "rgba(90,158,111,0.15)",
          color: "#5a9e6f",
        }}>
          Live Mock
        </div>
      )}
      {!showLive && (
        <div style={{
          alignSelf: "flex-start",
          padding: "2px 8px",
          fontSize: 10,
          fontWeight: 600,
          textTransform: "uppercase",
          letterSpacing: "0.05em",
          borderRadius: 3,
          background: "rgba(212,165,116,0.1)",
          color: "#d4a574",
        }}>
          Source View
        </div>
      )}

      {seed && (
        <div style={{
          padding: "8px 12px",
          background: "rgba(212,165,116,0.05)",
          borderRadius: 4,
          fontSize: 11,
          fontFamily: "var(--font-jetbrains-mono, monospace)",
          color: "var(--color-text-secondary, #a39787)",
          maxHeight: 80,
          overflow: "auto",
        }}>
          <strong style={{ color: "var(--color-accent, #d4a574)" }}>Seed data:</strong>
          <pre style={{ margin: "4px 0 0", whiteSpace: "pre-wrap" }}>
            {JSON.stringify(seed, null, 2).slice(0, 600)}
          </pre>
        </div>
      )}

      {showLive && (
        <ErrorBoundary fallback={(e) => (
          <div style={{
            flex: 1, display: "flex", flexDirection: "column", gap: 8,
            border: "1px solid rgba(220,38,38,0.2)", borderRadius: 6,
            background: "var(--color-surface, #111)", overflow: "auto",
          }}>
            <div style={{
              padding: "6px 12px", fontSize: 11, fontWeight: 600,
              background: "rgba(220,38,38,0.1)", color: "#ef4444",
            }}>
              Live render failed — {e.message}
            </div>
            <pre style={{
              flex: 1, margin: 0, padding: "12px", fontSize: 12, lineHeight: 1.5,
              fontFamily: "var(--font-jetbrains-mono, monospace)",
              color: "var(--color-text-primary, #f5f0eb)",
              whiteSpace: "pre-wrap",
            }}>
              {mockSrc ?? "// No mock source available"}
            </pre>
          </div>
        )}>
          <Suspense fallback={
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "var(--color-text-muted, #6b5f53)", fontSize: 12 }}>
              Rendering mock...
            </div>
          }>
            <div style={{
              flex: 1, overflow: "auto",
              padding: "16px",
              background: "#fff",
              borderRadius: 6,
              color: "#111",
            }}>
              <MockComponent />
            </div>
          </Suspense>
        </ErrorBoundary>
      )}

      {!showLive && (
        <pre
          style={{
            flex: 1,
            margin: 0,
            padding: "12px",
            fontSize: 12,
            lineHeight: 1.5,
            fontFamily: "var(--font-jetbrains-mono, monospace)",
            color: "var(--color-text-primary, #f5f0eb)",
            background: "var(--color-surface, #111)",
            borderRadius: 6,
            overflow: "auto",
            whiteSpace: "pre-wrap",
          }}
        >
          {mockSrc ?? "// No mock source available"}
        </pre>
      )}
    </div>
  );
}
