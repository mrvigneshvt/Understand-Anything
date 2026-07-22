"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useStore } from "@/lib/store";
import { getAccessToken } from "@/lib/token-gate";
import type { GraphNode } from "@understand-anything/core/types";

interface SearchResultItem {
  id: string;
  label: string;
  type: "page" | "api" | "schema";
  subtitle?: string;
  group?: string; // which page the API/schema belongs to
}

/** Try to import SearchEngine — graceful fallback if unavailable */
async function getSearchEngine() {
  try {
    const mod = await import("@understand-anything/core/search");
    return mod.SearchEngine as typeof import("@understand-anything/core/search").SearchEngine;
  } catch {
    return null;
  }
}

/** Build synthetic GraphNode[] from pages.json + api-map.json */
function buildGraphNodes(pages: any[], apiMap: Record<string, any>): GraphNode[] {
  const nodes: GraphNode[] = [];
  const seenIds = new Set<string>();

  for (const p of pages) {
    const id = `page:${p.id}`;
    if (seenIds.has(id)) continue;
    seenIds.add(id);
    nodes.push({
      id,
      type: "page",
      name: p.title ?? p.id,
      filePath: p.file,
      summary: p.route ?? "/",
      tags: [p.kind ?? "page", p.framework ?? "unknown"],
      complexity: "simple",
    });
  }

  // Add API calls from api-map
  for (const [, entry] of Object.entries(apiMap)) {
    for (const call of entry.calls ?? []) {
      const id = `api:${call.id}`;
      if (seenIds.has(id)) continue;
      seenIds.add(id);
      nodes.push({
        id,
        type: "endpoint",
        name: call.method + " " + (call.endpoint ?? ""),
        filePath: call.file,
        summary: call.endpoint ?? "",
        tags: ["api", call.method ?? "GET"],
        complexity: "simple",
      });
    }
    for (const schema of entry.schemas ?? []) {
      const id = `schema:${schema.name}`;
      if (seenIds.has(id)) continue;
      seenIds.add(id);
      nodes.push({
        id,
        type: "schema",
        name: schema.name,
        filePath: schema.file,
        summary: schema.kind ?? "unknown",
        tags: ["schema", schema.kind ?? "unknown"],
        complexity: "simple",
      });
    }
  }

  return nodes;
}

export function SearchBar() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResultItem[]>([]);
  const [open, setOpen] = useState(false);
  const [searchEngine, setSearchEngine] = useState<any>(null);
  const [allPages, setAllPages] = useState<any[]>([]);
  const [allApiMap, setAllApiMap] = useState<Record<string, any>>({});
  const inputRef = useRef<HTMLInputElement>(null);
  const { setCurrentPageId } = useStore();
  const useFallback = useRef(false);

  // Initialize: load data + try SearchEngine
  useEffect(() => {
    const token = getAccessToken();

    Promise.all([
      fetch(`/api/mocks/manifest.json?token=${token}`).then((r) => r.ok ? r.json() : { pages: [] }),
      fetch(`/api/mocks/api-map.json?token=${token}`).then((r) => r.ok ? r.json() : {}),
      getSearchEngine(),
    ]).then(([manifestData, apiMapData, Engine]) => {
      const pages = manifestData.pages ?? manifestData ?? [];
      setAllPages(pages);
      setAllApiMap(apiMapData);

      if (Engine) {
        const nodes = buildGraphNodes(pages, apiMapData);
        setSearchEngine(new Engine(nodes));
      } else {
        useFallback.current = true;
        console.warn("SearchEngine unavailable — using naive filter");
      }
    }).catch(() => {
      useFallback.current = true;
    });
  }, []);

  const doSearch = useCallback(async (q: string) => {
    if (!q.trim()) {
      setResults([]);
      return;
    }

    const qLower = q.toLowerCase();
    const matches: SearchResultItem[] = [];

    if (searchEngine && !useFallback.current) {
      // Use SearchEngine
      const searchResults = searchEngine.search(q, { limit: 20 });

      // Map SearchResult nodeIds back to Page/ApiCall ids
      for (const sr of searchResults) {
        const nodeId = sr.nodeId;
        if (nodeId.startsWith("page:")) {
          const pageId = nodeId.slice(5);
          const page = allPages.find((p: any) => p.id === pageId);
          if (page) {
            matches.push({
              id: page.id,
              label: page.title ?? page.id,
              type: "page",
              subtitle: page.route,
            });
          }
        } else if (nodeId.startsWith("api:")) {
          const callId = nodeId.slice(4);
          // Find which pages use this call
          for (const [pid, entry] of Object.entries(allApiMap)) {
            const call = (entry.calls ?? []).find((c: any) => c.id === callId);
            if (call) {
              matches.push({
                id: call.id,
                label: `${call.method} ${call.endpoint}`,
                type: "api",
                subtitle: `in ${pid}`,
                group: pid,
              });
              break;
            }
          }
        } else if (nodeId.startsWith("schema:")) {
          const schemaName = nodeId.slice(7);
          matches.push({
            id: schemaName,
            label: schemaName,
            type: "schema",
            subtitle: nodeId,
          });
        }
      }
    } else {
      // Naive filter fallback
      for (const p of allPages) {
        if ((p.title?.toLowerCase().includes(qLower)) || (p.route?.toLowerCase().includes(qLower))) {
          matches.push({
            id: p.id,
            label: p.title ?? p.id,
            type: "page",
            subtitle: p.route,
          });
        }
      }
    }

    setResults(matches.slice(0, 20));
  }, [searchEngine, allPages, allApiMap]);

  useEffect(() => {
    const timer = setTimeout(() => doSearch(query), 200);
    return () => clearTimeout(timer);
  }, [query, doSearch]);

  const handleSelect = (r: SearchResultItem) => {
    if (r.type === "page") {
      setCurrentPageId(r.id);
      window.history.pushState(null, "", `/page/${r.id}`);
    }
    setOpen(false);
    setQuery("");
  };

  // Group results by type
  const pageResults = results.filter((r) => r.type === "page");
  const apiResults = results.filter((r) => r.type === "api");
  const schemaResults = results.filter((r) => r.type === "schema");

  return (
    <div style={{ position: "relative", width: 240 }}>
      <input
        ref={inputRef}
        type="text"
        placeholder="Search pages, APIs, schemas..."
        value={query}
        onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 200)}
        style={{
          width: "100%",
          background: "rgba(255,255,255,0.05)",
          border: "1px solid rgba(212,165,116,0.15)",
          borderRadius: 4,
          padding: "6px 10px",
          fontSize: 12,
          color: "var(--color-text-primary, #f5f0eb)",
          outline: "none",
        }}
      />
      {open && results.length > 0 && (
        <div style={{
          position: "absolute",
          top: "100%",
          left: 0,
          right: 0,
          backgroundColor: "var(--color-elevated, #1a1a1a)",
          border: "1px solid rgba(212,165,116,0.15)",
          borderRadius: 4,
          marginTop: 4,
          zIndex: 100,
          maxHeight: 300,
          overflow: "auto",
        }}>
          {pageResults.length > 0 && (
            <>
              <div style={{ padding: "4px 12px", fontSize: 10, color: "var(--color-text-muted, #6b5f53)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Pages</div>
              {pageResults.map((r) => (
                <div
                  key={r.id}
                  onMouseDown={() => handleSelect(r)}
                  style={{ padding: "8px 12px", cursor: "pointer", fontSize: 12, borderBottom: "1px solid rgba(212,165,116,0.08)" }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "rgba(212,165,116,0.08)")}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
                >
                  <div style={{ color: "var(--color-text-primary, #f5f0eb)" }}>{r.label}</div>
                  {r.subtitle && <div style={{ color: "var(--color-text-muted, #6b5f53)", fontSize: 10 }}>{r.subtitle}</div>}
                </div>
              ))}
            </>
          )}
          {apiResults.length > 0 && (
            <>
              <div style={{ padding: "4px 12px", fontSize: 10, color: "var(--color-text-muted, #6b5f53)", textTransform: "uppercase", letterSpacing: "0.05em" }}>API Calls</div>
              {apiResults.map((r) => (
                <div key={r.id} style={{ padding: "8px 12px", fontSize: 12, borderBottom: "1px solid rgba(212,165,116,0.08)", opacity: 0.8 }}>
                  <div style={{ color: "var(--color-text-primary, #f5f0eb)" }}>{r.label}</div>
                  {r.subtitle && <div style={{ color: "var(--color-text-muted, #6b5f53)", fontSize: 10 }}>Called by: {r.subtitle}</div>}
                </div>
              ))}
            </>
          )}
          {schemaResults.length > 0 && (
            <>
              <div style={{ padding: "4px 12px", fontSize: 10, color: "var(--color-text-muted, #6b5f53)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Schemas</div>
              {schemaResults.map((r) => (
                <div key={r.id} style={{ padding: "8px 12px", fontSize: 12, borderBottom: "1px solid rgba(212,165,116,0.08)", opacity: 0.8 }}>
                  <div style={{ color: "var(--color-text-primary, #f5f0eb)" }}>{r.label}</div>
                  {r.subtitle && <div style={{ color: "var(--color-text-muted, #6b5f53)", fontSize: 10 }}>{r.subtitle}</div>}
                </div>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}
