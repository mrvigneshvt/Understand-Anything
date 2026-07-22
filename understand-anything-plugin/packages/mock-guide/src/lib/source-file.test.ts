import { describe, it, expect } from "vitest";
import { normalizeGraphPath, MAX_SOURCE_FILE_BYTES } from "./source-file";
import path from "node:path";

describe("normalizeGraphPath", () => {
  const projectRoot = "/home/user/project";

  it("normalizes a relative path", () => {
    expect(normalizeGraphPath("src/app.ts", projectRoot)).toBe("src/app.ts");
  });

  it("normalizes a path with dots", () => {
    expect(normalizeGraphPath("./src/app.ts", projectRoot)).toBe("src/app.ts");
  });

  it("rejects path traversal with ..", () => {
    expect(normalizeGraphPath("../etc/passwd", projectRoot)).toBeNull();
  });

  it("rejects deeply nested path traversal", () => {
    expect(normalizeGraphPath("../../etc/passwd", projectRoot)).toBeNull();
    expect(normalizeGraphPath("src/../../etc/passwd", projectRoot)).toBeNull();
  });

  it("rejects absolute paths", () => {
    expect(normalizeGraphPath("/etc/passwd", projectRoot)).toBeNull();
    expect(normalizeGraphPath("/absolute/path/file.ts", projectRoot)).toBeNull();
  });

  it("rejects paths containing null bytes", () => {
    expect(normalizeGraphPath("file\0.ts", projectRoot)).toBeNull();
  });

  it("rejects empty or dot-only paths", () => {
    expect(normalizeGraphPath("", projectRoot)).toBeNull();
    expect(normalizeGraphPath(".", projectRoot)).toBeNull();
    expect(normalizeGraphPath("..", projectRoot)).toBeNull();
  });

  it("resolves absolute paths within project to relative", () => {
    const result = normalizeGraphPath(
      path.join(projectRoot, "src/app.ts"),
      projectRoot,
    );
    expect(result).toBe("src/app.ts");
  });

  it("rejects absolute paths outside project", () => {
    const result = normalizeGraphPath(
      "/other/project/file.ts",
      projectRoot,
    );
    expect(result).toBeNull();
  });
});

describe("readSourceFile safety constants", () => {
  it("caps at 1MB", () => {
    expect(MAX_SOURCE_FILE_BYTES).toBe(1024 * 1024);
  });
});
