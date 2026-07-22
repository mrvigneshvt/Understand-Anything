import fs from "node:fs";
import path from "node:path";

const MAX_SOURCE_FILE_BYTES = 1024 * 1024;

export interface FileContent {
  path: string;
  language: string;
  content: string;
  sizeBytes: number;
  lineCount: number;
}

/**
 * Normalize a file path to a safe relative path.
 * Returns null if the path is invalid, absolute, or tries to escape.
 */
export function normalizeGraphPath(filePath: string, projectRoot: string): string | null {
  const rawPath = path.isAbsolute(filePath)
    ? filePath.startsWith(projectRoot)
      ? path.relative(projectRoot, filePath)
      : null
    : filePath;

  if (rawPath === null) return null;

  const normalized = path.normalize(rawPath);
  if (
    !normalized ||
    normalized === "." ||
    normalized.includes("\0") ||
    normalized === ".." ||
    normalized.startsWith(`..${path.sep}`) ||
    path.isAbsolute(normalized)
  ) {
    return null;
  }

  return normalized.split(path.sep).join("/");
}

function detectLanguage(filePath: string): string {
  const ext = path.extname(filePath).slice(1).toLowerCase();
  const byExt: Record<string, string> = {
    bash: "bash", c: "c", cc: "cpp", cpp: "cpp", cs: "csharp", css: "css",
    go: "go", h: "c", hpp: "cpp", html: "markup", java: "java",
    js: "javascript", jsx: "jsx", json: "json", md: "markdown",
    mjs: "javascript", py: "python", rb: "ruby", rs: "rust", sh: "bash",
    ts: "typescript", tsx: "tsx", txt: "text", yaml: "yaml", yml: "yaml",
  };
  return byExt[ext] ?? "text";
}

/**
 * Read a source file with safety checks.
 * Returns { statusCode, payload } — payload.error on failure.
 */
export function readSourceFile(
  requestedPath: string,
  projectRoot: string,
): { statusCode: number; payload: FileContent | { error: string } } {
  const reject = (message: string, statusCode = 400) => ({
    statusCode,
    payload: { error: message },
  });

  if (!requestedPath) return reject("Missing path");
  if (requestedPath.includes("\0")) return reject("Invalid path");
  if (path.isAbsolute(requestedPath)) return reject("Absolute paths are not allowed");

  const normalizedPath = path.normalize(requestedPath);
  if (
    normalizedPath === "." ||
    normalizedPath.startsWith(`..${path.sep}`) ||
    normalizedPath === ".." ||
    path.isAbsolute(normalizedPath)
  ) {
    return reject("Path must stay inside the project");
  }

  const absoluteFile = path.resolve(projectRoot, normalizedPath);
  const relativeToRoot = path.relative(projectRoot, absoluteFile);
  if (
    !relativeToRoot ||
    relativeToRoot.startsWith(`..${path.sep}`) ||
    relativeToRoot === ".." ||
    path.isAbsolute(relativeToRoot)
  ) {
    return reject("Path must stay inside the project");
  }

  const safeRelativePath = relativeToRoot.split(path.sep).join("/");

  let stat: fs.Stats;
  try {
    stat = fs.statSync(absoluteFile);
  } catch {
    return reject("File not found", 404);
  }

  if (!stat.isFile()) return reject("Path is not a file");
  if (stat.size > MAX_SOURCE_FILE_BYTES) return reject("File is too large to preview", 413);

  const buffer = fs.readFileSync(absoluteFile);
  // Check for null bytes — binary file
  if (buffer.includes(0)) return reject("Binary files cannot be previewed", 415);

  const content = buffer.toString("utf8");
  return {
    statusCode: 200,
    payload: {
      path: safeRelativePath,
      language: detectLanguage(safeRelativePath),
      content,
      sizeBytes: buffer.byteLength,
      lineCount: content.length === 0 ? 0 : content.split(/\r\n|\n|\r/).length,
    },
  };
}

export { MAX_SOURCE_FILE_BYTES };
