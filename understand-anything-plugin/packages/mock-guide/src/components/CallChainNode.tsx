import { useStore } from "@/lib/store";
import { LlmExplain } from "./LlmExplain";

const KIND_COLORS: Record<string, { bg: string; text: string }> = {
  ui: { bg: "#dbeafe", text: "#1e40af" },
  hook: { bg: "#f3e8ff", text: "#6b21a8" },
  store: { bg: "#fef3c7", text: "#92400e" },
  fetch: { bg: "#ccfbf1", text: "#115e59" },
  server: { bg: "#fee2e2", text: "#991b1b" },
  service: { bg: "#fef9c3", text: "#854d0e" },
  model: { bg: "#dcfce7", text: "#166534" },
  type: { bg: "#f3f4f6", text: "#374151" },
  controller: { bg: "#e0e7ff", text: "#3730a3" },
};

const KIND_DESCRIPTIONS: Record<string, string> = {
  ui: "UI component that renders the page",
  hook: "React hook managing state or side effects",
  store: "State management store (Zustand)",
  fetch: "API call to external service",
  server: "Server-side handler or action",
  service: "Business logic service layer",
  model: "Data model definition",
  type: "TypeScript type or interface",
  controller: "API route controller",
};

interface AnnotationNode {
  id: string;
  label: string;
  kind: string;
  file: string;
  line: number;
  children?: AnnotationNode[];
}

interface CallChainNodeProps {
  node: AnnotationNode;
  depth: number;
  onSelect: (file: string, line: number) => void;
  highlightedBinding?: string | null;
  onHover?: (label: string) => void;
}

export function CallChainNodeView({ node, depth, onSelect, highlightedBinding, onHover }: CallChainNodeProps) {
  const colors = KIND_COLORS[node.kind] ?? { bg: "#f3f4f6", text: "#374151" };
  const { currentPersona } = useStore();

  const isHighlighted = highlightedBinding === node.label || highlightedBinding === node.id;
  const showTooltip = currentPersona === "junior"; // Junior = plain-English tooltips
  const showSource = currentPersona !== "non-technical"; // Non-technical hides source, experienced gets it straight

  return (
    <div
      style={{
        marginLeft: depth * 16,
        backgroundColor: isHighlighted ? "rgba(212,165,116,0.12)" : "transparent",
        borderRadius: 4,
        transition: "background 0.2s",
        scrollMarginTop: 100,
      }}
      ref={(el) => {
        if (isHighlighted && el) el.scrollIntoView({ behavior: "smooth", block: "center" });
      }}
    >
      <div
        onClick={() => onSelect(node.file, node.line)}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = "rgba(255,255,255,0.05)";
          onHover?.(node.label);
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = "transparent";
          onHover?.("");
        }}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "6px 8px",
          cursor: "pointer",
          borderRadius: 4,
          fontSize: 13,
          fontFamily: "var(--font-jetbrains-mono, monospace)",
          transition: "background 0.1s",
        }}
        data-ua-binding={node.label}
      >
        <span
          style={{
            display: "inline-block",
            padding: "1px 6px",
            borderRadius: 3,
            fontSize: 10,
            fontWeight: 600,
            textTransform: "uppercase",
            letterSpacing: "0.05em",
            backgroundColor: colors.bg,
            color: colors.text,
          }}
        >
          {node.kind}
        </span>
        <span style={{ color: "var(--color-text-primary, #f5f0eb)" }}>
          {node.label}
          {showTooltip && (
            <span style={{ marginLeft: 8, fontSize: 10, color: "var(--color-text-muted, #6b5f53)", fontStyle: "italic" }}>
              — {KIND_DESCRIPTIONS[node.kind] ?? ""}
            </span>
          )}
        </span>
        {showSource && (
          <span style={{ color: "var(--color-text-muted, #6b5f53)", fontSize: 11 }}>
            {node.file}:{node.line}
          </span>
        )}
      </div>
      <div style={{ paddingLeft: 16 }}>
        <LlmExplain nodeId={node.id} file={node.file} line={node.line} />
      </div>
      {node.children?.map((child) => (
        <CallChainNodeView
          key={child.id}
          node={child}
          depth={depth + 1}
          onSelect={onSelect}
          highlightedBinding={highlightedBinding}
          onHover={onHover}
        />
      ))}
    </div>
  );
}
