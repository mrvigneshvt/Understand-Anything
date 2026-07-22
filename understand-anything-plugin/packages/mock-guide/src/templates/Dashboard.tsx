"use client";

import React from "react";

interface DashboardTemplateProps {
  seed?: { stats?: Array<{ label: string; value: number; change?: string }> };
  copy?: { title?: string; activityLabel?: string; chartLabel?: string };
}

export function DashboardTemplate({ seed, copy }: DashboardTemplateProps) {
  const c = copy ?? { title: "Dashboard", activityLabel: "Recent Activity", chartLabel: "Chart" };
  const stats = seed?.stats ?? [
    { label: "Users", value: 1284, change: "+12%" },
    { label: "Orders", value: 347, change: "+5%" },
    { label: "Revenue", value: 48250, change: "-2%" },
  ];

  return (
    <div>
      <h1 data-ua-binding="dashboard-title" className="mb-6 text-2xl font-bold">{c.title}</h1>
      <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-3" data-ua-binding="dashboard-stats">
        {stats.map((s, i) => (
          <div key={i} className="rounded border bg-white p-4 shadow-sm" data-ua-binding={`dashboard-stat-${i}`}>
            <p className="text-sm text-gray-500">{s.label}</p>
            <p className="mt-1 text-2xl font-bold">{s.value.toLocaleString()}</p>
            {s.change && <p className="mt-1 text-sm text-gray-600">{s.change}</p>}
          </div>
        ))}
      </div>
      <h2 className="mb-3 text-lg font-semibold" data-ua-binding="dashboard-activity-title">{c.activityLabel}</h2>
      <div className="rounded border bg-white p-4" data-ua-binding="dashboard-activity">
        <p className="text-sm text-gray-400">{c.chartLabel} placeholder</p>
      </div>
    </div>
  );
}
