"use client";

import { useEffect, useState, useCallback } from "react";
import { getAccessToken } from "@/lib/token-gate";
import { useStore } from "@/lib/store";
import { CallChainNodeView } from "./CallChainNode";
import { SourceViewer } from "./SourceViewer";

interface AnnotationNode {
  id: string;
  label: string;
  kind: string;
  file: string;
  line: number;
  children?: AnnotationNode[];
}

interface PageAnnotation {
  pageId: string;
  pageName: string;
  pageRoute: string;
  nodes: AnnotationNode[];
  uiBindings?: { selector: string; type: string; description: string }[];
}

interface AnnotationPanelProps {
  pageId: string | null;
}

export function AnnotationPanel({ pageId }: AnnotationPanelProps) {
  const [annotation, setAnnotation] = useState<PageAnnotation | null>(null);
  const [loading, setLoading] = useState(false);
  const bindingHover = useStore((s) => s.bindingHover);
  const setBindingHover = useStore((s) => s.setBindingHover);

  const handleBindingHover = useCallback((label: string) => {
    setBindingHover(label || null);
  }, [setBindingHover]);

  const [selectedSource, setSelectedSource] = useState<{ file: string; line: number } | null>(null);

  useEffect(() => {
    if (!pageId) return;
    setLoading(true);
    setAnnotation(null);
    setSelectedSource(null);

    const token = getAccessToken();
    fetch(`/api/annotations/${encodeURIComponent(pageId)}.json?token=${token}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        setAnnotation(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [pageId]);

  if (!pageId) {
    return (
      <div style={{ padding: 16, color: "var(--color-text-muted, #6b5f53)", fontSize: 13 }}>
        Select a page to view annotations
      </div>
    );
  }

  if (loading) {
    return <div style={{ padding: 16, color: "var(--color-text-muted, #6b5f53)" }}>Loading annotations...</div>;
  }

  return (
    <div style={{ padding: 12 }}>
      <h3 style={{ fontSize: 14, fontWeight: 600, margin: "0 0 12px", color: "var(--color-text-primary, #f5f0eb)" }}>
        Call Chain
      </h3>
      {annotation ? (
        <>
          {annotation.nodes.map((node) => (
            <CallChainNodeView
              key={node.id}
              node={node}
              depth={0}
              onSelect={(file, line) => setSelectedSource({ file, line })}
              onHover={handleBindingHover}
              highlightedBinding={bindingHover}
            />
          ))}
          {annotation.uiBindings && annotation.uiBindings.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <h4 style={{ fontSize: 12, fontWeight: 600, color: "var(--color-text-secondary, #a39787)", marginBottom: 8 }}>
                UI Bindings ({annotation.uiBindings.length})
              </h4>
              {annotation.uiBindings.map((b, i) => (
                <div key={i} style={{ fontSize: 11, color: "var(--color-text-muted, #6b5f53)", padding: "2px 0" }}>
                  {b.selector} — {b.description}
                </div>
              ))}
            </div>
          )}
          {selectedSource && (
            <div style={{ marginTop: 16 }}>
              <SourceViewer
                file={selectedSource.file}
                line={selectedSource.line}
                onClose={() => setSelectedSource(null)}
              />
            </div>
          )}
        </>
      ) : (
        <p style={{ fontSize: 12, color: "var(--color-text-muted, #6b5f53)" }}>
          No annotation data available for this page.
        </p>
      )}
    </div>
  );
}
