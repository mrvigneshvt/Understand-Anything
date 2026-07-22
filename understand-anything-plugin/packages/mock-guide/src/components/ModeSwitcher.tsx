"use client";

import { useStore } from "@/lib/store";
import type { MockMode } from "@/lib/store";

const MODES: { value: MockMode; label: string }[] = [
  { value: "screenshot", label: "Screenshot" },
  { value: "structural", label: "Structural" },
  { value: "template", label: "Template" },
];

export function ModeSwitcher() {
  const { currentMode, setCurrentMode } = useStore();

  return (
    <select
      value={currentMode}
      onChange={(e) => setCurrentMode(e.target.value as MockMode)}
      style={{
        background: "rgba(212,165,116,0.1)",
        border: "1px solid rgba(212,165,116,0.2)",
        color: "var(--color-accent, #d4a574)",
        borderRadius: 4,
        padding: "4px 8px",
        fontSize: 12,
        cursor: "pointer",
      }}
    >
      {MODES.map((m) => (
        <option key={m.value} value={m.value}>{m.label}</option>
      ))}
    </select>
  );
}