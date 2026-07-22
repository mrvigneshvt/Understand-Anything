"use client";

import React from "react";

interface SettingsTemplateProps {
  seed?: { toggles?: Array<{ key: string; label: string; value: boolean }> };
  copy?: { title?: string; saveLabel?: string };
}

export function SettingsTemplate({ seed, copy }: SettingsTemplateProps) {
  const c = copy ?? { title: "Settings", saveLabel: "Save" };
  const toggles = seed?.toggles ?? [
    { key: "notifications", label: "Notifications", value: true },
    { key: "darkMode", label: "Dark Mode", value: false },
  ];

  return (
    <div className="mx-auto max-w-md">
      <h1 data-ua-binding="settings-title" className="mb-6 text-2xl font-bold">{c.title}</h1>
      <div className="space-y-4" data-ua-binding="settings-list">
        {toggles.map((t) => (
          <label key={t.key} className="flex items-center justify-between rounded border bg-white px-4 py-3" data-ua-binding={`settings-${t.key}`}>
            <span>{t.label}</span>
            <input type="checkbox" defaultChecked={t.value} data-ua-binding={`settings-${t.key}-toggle`} />
          </label>
        ))}
      </div>
      <button data-ua-binding="settings-save" className="mt-4 rounded bg-blue-600 px-4 py-2 text-white">{c.saveLabel}</button>
    </div>
  );
}
