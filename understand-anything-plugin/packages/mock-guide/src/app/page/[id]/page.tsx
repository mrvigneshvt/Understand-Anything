"use client";

import { useParams } from "next/navigation";
import { useEffect } from "react";
import { useStore } from "@/lib/store";
import { getAccessToken } from "@/lib/token-gate";
import { MockFrame } from "@/components/MockFrame";
import { AnnotationPanel } from "@/components/AnnotationPanel";
import { PagesList } from "@/components/PagesList";

export default function PageDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { currentPageId, setCurrentPageId } = useStore();

  useEffect(() => {
    if (id && id !== currentPageId) {
      setCurrentPageId(id);
    }
  }, [id, currentPageId, setCurrentPageId]);

  const handleSelectPage = (pageId: string) => {
    setCurrentPageId(pageId);
    const token = getAccessToken();
    window.history.pushState(null, "", `/page/${pageId}${token ? `?token=${token}` : ""}`);
  };

  return (
    <div style={{ display: "flex", height: "100%", position: "relative" }}>
      <PagesList currentPageId={currentPageId} onSelect={handleSelectPage} />
      <div style={{ flex: 1, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 0 }}>
        <div style={{ padding: 16, borderRight: "1px solid rgba(212,165,116,0.1)" }}>
          <h2 style={{ fontSize: 13, fontWeight: 600, color: "var(--color-text-secondary, #a39787)", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Mock
          </h2>
          <MockFrame pageId={currentPageId} />
        </div>
        <AnnotationPanel pageId={currentPageId} />
      </div>
    </div>
  );
}
