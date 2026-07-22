"use client";

import React from "react";

interface DetailTemplateProps {
  seed?: { fields?: Array<{ label: string; value: string }> };
  copy?: { title?: string; backLabel?: string };
}

export function DetailTemplate({ seed, copy }: DetailTemplateProps) {
  const c = copy ?? { title: "Detail", backLabel: "Back" };
  const fields = seed?.fields ?? [{ label: "ID", value: "—" }, { label: "Status", value: "Active" }];

  return (
    <div>
      <button data-ua-binding="detail-back" className="mb-4 text-sm text-blue-600">{c.backLabel} &larr;</button>
      <h1 data-ua-binding="detail-title" className="mb-6 text-2xl font-bold">{c.title}</h1>
      <div className="rounded border bg-white p-6 shadow-sm" data-ua-binding="detail-card">
        {fields.map((f, i) => (
          <p key={i} className="mb-2"><strong>{f.label}:</strong> {f.value}</p>
        ))}
      </div>
    </div>
  );
}
