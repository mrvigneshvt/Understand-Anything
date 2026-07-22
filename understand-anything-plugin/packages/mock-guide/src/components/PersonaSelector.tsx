"use client";

import { useStore } from "@/lib/store";
import type { Persona } from "@/lib/store";

const PERSONAS: { value: Persona; label: string }[] = [
  { value: "non-technical", label: "Non-technical" },
  { value: "junior", label: "Junior" },
  { value: "experienced", label: "Experienced" },
];

export function PersonaSelector() {
  const { currentPersona, setCurrentPersona } = useStore();

  return (
    <select
      value={currentPersona}
      onChange={(e) => setCurrentPersona(e.target.value as Persona)}
      style={{
        background: "none",
        border: "1px solid var(--color-text-muted, #6b5f53)",
        color: "var(--color-text-primary, #f5f0eb)",
        borderRadius: 4,
        padding: "4px 8px",
        fontSize: 12,
        cursor: "pointer",
      }}
    >
      {PERSONAS.map((p) => (
        <option key={p.value} value={p.value}>{p.label}</option>
      ))}
    </select>
  );
}