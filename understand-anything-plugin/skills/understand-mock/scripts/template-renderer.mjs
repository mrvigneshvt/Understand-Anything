#!/usr/bin/env node
/**
 * template-renderer.mjs — map pages to templates and generate mock output.
 *
 * Usage:
 *   node template-renderer.mjs [projectDir] [--no-llm] [--mode <name>]
 */

import fs from "node:fs";
import path from "node:path";

const TEMPLATE_NAMES = ["Login", "List", "Detail", "Form", "Dashboard", "Settings"];

/** Map a page to a template type using heuristics (--no-llm path) */
function heuristicTemplateMapping(page) {
  const route = page.route ?? "";
  const name = page.name ?? "";
  const file = page.file ?? "";
  const lower = `${route} ${name} ${file}`.toLowerCase();

  if (lower.includes("login") || lower.includes("signin") || lower.includes("auth")) return "Login";
  if (lower.includes("dashboard") || lower.includes("overview") || lower.includes("home")) return "Dashboard";
  if (lower.includes("settings") || lower.includes("preferences") || lower.includes("config")) return "Settings";
  if (lower.includes("order") || lower.includes("detail") || lower.includes("show") || lower.includes("view") || lower.includes("card")) return "Detail";
  if (lower.includes("new") || lower.includes("create") || lower.includes("edit") || lower.includes("form")) return "Form";
  if (lower.includes("list") || lower.includes("table") || lower.includes("index") || lower.includes("browse") || lower.includes("all")) return "List";

  // CLI commands → Form
  if (page.type === "cli") return "Form";
  // Library exports → Detail
  if (page.type === "export") return "Detail";

  return "Detail"; // default
}

/** Generate deterministic copy for a template */
function generateCopy(templateName, page) {
  const name = page.name ?? "Page";
  const route = page.route ?? "/";

  switch (templateName) {
    case "Login":
      return { title: `Sign in to ${name}`, emailLabel: "Email", passwordLabel: "Password", submitLabel: "Sign in" };
    case "List":
      return { title: `${name} List`, emptyLabel: "No items found" };
    case "Detail":
      return { title: `${name} Details`, backLabel: "Back" };
    case "Form":
      return { title: `Create ${name}`, submitLabel: "Create", cancelLabel: "Cancel" };
    case "Dashboard":
      return { title: `${name} Overview`, activityLabel: "Recent Activity", chartLabel: "Revenue Chart" };
    case "Settings":
      return { title: `${name} Settings`, saveLabel: "Save Changes" };
    default:
      return { title: name };
  }
}

/** Generate seed data compatible with the template */
function generateSeed(templateName, page, apiCalls) {
  switch (templateName) {
    case "Login":
      return { users: [{ email: "user@example.com" }] };
    case "List":
      return {
        columns: ["Name", "Email", "Status"],
        items: [
          { id: "1", name: "Item 1", value: "Active" },
          { id: "2", name: "Item 2", value: "Pending" },
          { id: "3", name: "Item 3", value: "Inactive" },
        ],
      };
    case "Detail":
      return {
        fields: [
          { label: "ID", value: page.id ?? "—" },
          { label: "Route", value: page.route ?? "/" },
          { label: "Type", value: page.type ?? "page" },
          { label: "Framework", value: page.framework ?? "unknown" },
        ],
      };
    case "Form":
      return {
        fields: [
          { name: "name", label: "Name", type: "text" },
          { name: "email", label: "Email", type: "email" },
          { name: "notes", label: "Notes", type: "text" },
        ],
      };
    case "Dashboard":
      return {
        stats: [
          { label: "Users", value: 1284, change: "+12%" },
          { label: "Orders", value: 347, change: "+5%" },
          { label: "Revenue", value: 48250, change: "-2%" },
        ],
      };
    case "Settings":
      return {
        toggles: [
          { key: "notifications", label: "Notifications", value: true },
          { key: "darkMode", label: "Dark Mode", value: false },
          { key: "autoSave", label: "Auto Save", value: true },
        ],
      };
    default:
      return {};
  }
}

/** Generate the mock component file that imports and renders the template */
function generateMockFile(templateName, pageId, seed, copy) {
  return [
    `"use client";`,
    `import React from "react";`,
    `import { ${templateName}Template } from "@/templates/${templateName}";`,
    `import { MockDataProvider } from "@/mocks/MockDataProvider";`,
    ``,
    `const seedData = ${JSON.stringify(seed, null, 2)};`,
    `const copyData = ${JSON.stringify(copy, null, 2)};`,
    ``,
    `export default function ${pageId.replace(/[^a-zA-Z0-9]/g, "_")}Mock() {`,
    `  return (`,
    `    <MockDataProvider pageId="${pageId}" seedData={seedData}>`,
    `      <${templateName}Template seed={seedData} copy={copyData} />`,
    `    </MockDataProvider>`,
    `  );`,
    `}`,
    ``,
  ].join("\n");
}

/* ------------------------------------------------------------------ */
/*  Main                                                               */
/* ------------------------------------------------------------------ */

/**
 * @param {string} projectDir
 * @param {{ noLlm?: boolean }} options
 * @returns {{ mocks: number; templates: number }}
 */
export function renderTemplates(projectDir, options = {}) {
  const pagesPath = path.join(projectDir, ".ua", "mock-guide", "pages.json");
  let pagesJson;
  try { pagesJson = JSON.parse(fs.readFileSync(pagesPath, "utf-8")); } catch { return { mocks: 0, templates: 0 }; }

  const pages = pagesJson.pages || [];
  const mocksDir = path.join(projectDir, ".ua", "mock-guide", "mocks");
  const seedsDir = path.join(projectDir, ".ua", "mock-guide", "seed");
  fs.mkdirSync(mocksDir, { recursive: true });
  fs.mkdirSync(seedsDir, { recursive: true });

  let mockCount = 0;

  for (const page of pages) {
    // Determine template via heuristic (no LLM) or future LLM path
    const templateName = heuristicTemplateMapping(page);
    const copy = generateCopy(templateName, page);
    const seed = generateSeed(templateName, page, []);

    // Write seed
    const seedPath = path.join(seedsDir, `${page.id}.json`);
    fs.writeFileSync(seedPath, JSON.stringify(seed, null, 2), "utf-8");

    // Write mock file
    const mockContent = generateMockFile(templateName, page.id, seed, copy);
    const mockPath = path.join(mocksDir, `${page.id}.tsx`);
    fs.writeFileSync(mockPath, mockContent, "utf-8");
    mockCount++;
  }

  console.log(`Rendered ${mockCount} template mocks`);
  return { mocks: mockCount, templates: TEMPLATE_NAMES.length };
}

function main() {
  const args = process.argv.slice(2);
  let projectDir = process.cwd();

  for (let i = 0; i < args.length; i++) {
    if (!args[i].startsWith("--")) projectDir = path.resolve(args[i]);
  }

  if (!fs.existsSync(projectDir)) {
    console.error(`Error: directory not found: ${projectDir}`);
    process.exit(1);
  }

  renderTemplates(projectDir);
}

if (process.argv[1] && process.argv[1].endsWith("template-renderer.mjs")) {
  main();
}
