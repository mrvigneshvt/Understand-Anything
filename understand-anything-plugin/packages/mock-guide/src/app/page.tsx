"use client";

import { useStore } from "@/lib/store";
import { PagesList } from "@/components/PagesList";
import { getAccessToken } from "@/lib/token-gate";

export default function HomePage() {
  const { setCurrentPageId } = useStore();

  const handleSelectPage = (pageId: string) => {
    setCurrentPageId(pageId);
    const token = getAccessToken();
    window.location.href = `/page/${pageId}${token ? `?token=${token}` : ""}`;
  };

  return (
    <div style={{ display: "flex", height: "100%", position: "relative" }}>
      <PagesList currentPageId={null} onSelect={handleSelectPage} />
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ textAlign: "center", maxWidth: 400 }}>
          <h2 style={{ fontSize: "1.25rem", fontWeight: 600, margin: "0 0 0.5rem", color: "var(--color-text-primary, #f5f0eb)" }}>
            Mock Understand Everything
          </h2>
          <p style={{ color: "var(--color-text-secondary, #a39787)", lineHeight: 1.6, marginBottom: 16 }}>
            Select a page from the sidebar to view its mock data, annotations, and full-stack call chain.
          </p>
          <p style={{ color: "var(--color-text-muted, #6b5f53)", fontSize: 13 }}>
            Run the page detector, API mapper, and annotation builder to populate the guidebook.
          </p>
        </div>
      </div>
    </div>
  );
}
