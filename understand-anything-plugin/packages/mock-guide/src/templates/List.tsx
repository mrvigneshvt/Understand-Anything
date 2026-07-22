"use client";

import React from "react";

interface ListTemplateProps {
  seed?: { items?: Array<{ id: string; name: string; value: string }>; columns?: string[] };
  copy?: { title?: string; emptyLabel?: string };
}

export function ListTemplate({ seed, copy }: ListTemplateProps) {
  const c = copy ?? { title: "Items", emptyLabel: "No items found" };
  const items = seed?.items ?? [];
  const columns = seed?.columns ?? ["Name", "Value"];

  return (
    <div>
      <h1 data-ua-binding="list-title" className="mb-6 text-2xl font-bold">{c.title}</h1>
      {items.length === 0 ? (
        <p className="text-gray-500">{c.emptyLabel}</p>
      ) : (
        <table className="min-w-full divide-y divide-gray-200" data-ua-binding="list-table">
          <thead>
            <tr>
              {columns.map((col, i) => (
                <th key={i} className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">{col}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {items.map((item) => (
              <tr key={item.id} data-ua-binding={`list-row-${item.id}`}>
                <td className="px-4 py-2 text-sm">{item.name}</td>
                <td className="px-4 py-2 text-sm text-gray-600">{item.value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
