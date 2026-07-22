"use client";

import React from "react";

interface LoginTemplateProps {
  seed?: { users?: Array<{ email: string }> };
  copy?: { title?: string; emailLabel?: string; passwordLabel?: string; submitLabel?: string };
}

export function LoginTemplate({ seed, copy }: LoginTemplateProps) {
  const c = copy ?? { title: "Sign in", emailLabel: "Email", passwordLabel: "Password", submitLabel: "Sign in" };
  return (
    <div className="mx-auto max-w-sm pt-20">
      <h1 data-ua-binding="login-title" className="mb-6 text-2xl font-bold">{c.title}</h1>
      <form className="space-y-4">
        <div>
          <label className="block text-sm font-medium">{c.emailLabel}</label>
          <input type="email" defaultValue={seed?.users?.[0]?.email ?? ""} className="mt-1 w-full rounded border px-3 py-2" data-ua-binding="login-email" />
        </div>
        <div>
          <label className="block text-sm font-medium">{c.passwordLabel}</label>
          <input type="password" className="mt-1 w-full rounded border px-3 py-2" data-ua-binding="login-password" />
        </div>
        <button type="submit" data-ua-binding="login-submit" className="w-full rounded bg-blue-600 py-2 text-white">{c.submitLabel}</button>
      </form>
    </div>
  );
}
