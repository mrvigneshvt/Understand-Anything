"use client";

import React from "react";

interface FormTemplateProps {
  seed?: { fields?: Array<{ name: string; label: string; type?: string }> };
  copy?: { title?: string; submitLabel?: string; cancelLabel?: string };
}

export function FormTemplate({ seed, copy }: FormTemplateProps) {
  const c = copy ?? { title: "Form", submitLabel: "Submit", cancelLabel: "Cancel" };
  const fields = seed?.fields ?? [
    { name: "name", label: "Name", type: "text" },
    { name: "email", label: "Email", type: "email" },
  ];

  return (
    <div className="mx-auto max-w-md">
      <h1 data-ua-binding="form-title" className="mb-6 text-2xl font-bold">{c.title}</h1>
      <form className="space-y-4" data-ua-binding="form">
        {fields.map((f) => (
          <div key={f.name}>
            <label className="block text-sm font-medium">{f.label}</label>
            <input type={f.type ?? "text"} name={f.name} className="mt-1 w-full rounded border px-3 py-2" data-ua-binding={`form-${f.name}`} />
          </div>
        ))}
        <div className="flex gap-3">
          <button type="submit" data-ua-binding="form-submit" className="rounded bg-blue-600 px-4 py-2 text-white">{c.submitLabel}</button>
          <button type="button" data-ua-binding="form-cancel" className="rounded border px-4 py-2">{c.cancelLabel}</button>
        </div>
      </form>
    </div>
  );
}
