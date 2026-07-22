import { describe, it, expect } from "vitest";
import { parseArgs } from "./cli.mjs";

describe("CLI flags", () => {
  it("parses default values when no flags given", () => {
    const opts = parseArgs([]);
    expect(opts.mode).toBe("structural");
    expect(opts.pagesOnly).toBe(false);
    expect(opts.noLlm).toBe(false);
    expect(opts.port).toBe(5174);
    expect(opts.noOpen).toBe(false);
    expect(opts.exclude).toEqual([]);
  });

  it("parses --pages-only flag", () => {
    const opts = parseArgs(["--pages-only", "/some/dir"]);
    expect(opts.pagesOnly).toBe(true);
    expect(opts.projectDir).toBe("/some/dir");
  });

  it("parses --no-llm flag", () => {
    const opts = parseArgs(["--no-llm"]);
    expect(opts.noLlm).toBe(true);
  });

  it("parses --port override", () => {
    const opts = parseArgs(["--port", "8080"]);
    expect(opts.port).toBe(8080);
  });

  it("parses --mode flag", () => {
    const opts = parseArgs(["--mode", "template"]);
    expect(opts.mode).toBe("template");
  });

  it("parses --exclude patterns", () => {
    const opts = parseArgs(["--exclude", "node_modules,dist"]);
    expect(opts.exclude).toEqual(["node_modules", "dist"]);
  });

  it("parses projectDir as first positional arg", () => {
    const opts = parseArgs(["/custom/project", "--no-llm"]);
    expect(opts.projectDir).toBe("/custom/project");
    expect(opts.noLlm).toBe(true);
  });
});

describe("SKILL.md", () => {
  it("exists and documents the pipeline", () => {
    const fs = require("fs");
    const content = fs.readFileSync(
      new URL("../SKILL.md", import.meta.url).pathname,
      "utf-8",
    );
    expect(content).toContain("Detect pages");
    expect(content).toContain("Map APIs");
    expect(content).toContain("Generate mocks");
    expect(content).toContain("Build annotations");
    expect(content).toContain("Serve guidebook");
    expect(content).toContain("--no-llm");
    expect(content).toContain("--pages-only");
    expect(content).toContain("--port");
  });
});
