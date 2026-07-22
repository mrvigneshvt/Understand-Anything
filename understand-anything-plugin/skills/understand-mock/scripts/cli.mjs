#!/usr/bin/env node
/**
 * cli.mjs — CLI flag parsing for the understand-mock pipeline.
 *
 * Flags: --mode, --pages-only, --no-llm, --language, --port, --no-open, --exclude
 */

/**
 * @returns {{ projectDir: string; mode: string; pagesOnly: boolean; noLlm: boolean;
 *   language?: string; port: number; noOpen: boolean; exclude: string[]; maxPages: number }}
 */
export function parseArgs(args = process.argv.slice(2)) {
  let projectDir = process.cwd();
  let mode = "structural";
  let pagesOnly = false;
  let noLlm = false;
  let language;
  let port = 5174;
  let noOpen = false;
  let exclude = [];
  let maxPages = 50;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    switch (arg) {
      case "--mode":
        mode = args[++i] ?? mode;
        if (!["structural", "screenshot", "template"].includes(mode)) {
          console.error(`Error: --mode must be structural, screenshot, or template (got: ${mode})`);
          process.exit(1);
        }
        break;
      case "--pages-only":
        pagesOnly = true;
        break;
      case "--no-llm":
        noLlm = true;
        break;
      case "--language":
        language = args[++i];
        break;
      case "--max-pages": {
        const val = parseInt(args[++i] ?? "", 10);
        if (isNaN(val) || val < 1) {
          console.error("Error: --max-pages must be a positive integer (got: " + args[i] + ")");
          process.exit(1);
        }
        maxPages = val;
        break;
      }
      case "--port": {
        const val = parseInt(args[++i] ?? "", 10);
        if (isNaN(val) || val < 1 || val > 65535) {
          console.error("Error: --port must be a valid port number (1-65535)");
          process.exit(1);
        }
        port = val;
        break;
      }
      case "--no-open":
        noOpen = true;
        break;
      case "--exclude": {
        const raw = args[++i] ?? "";
        exclude = raw.split(/[, ]/).filter(Boolean);
        break;
      }
      default:
        if (!arg.startsWith("--")) {
          projectDir = arg;
        }
        break;
    }
  }

  return { projectDir, mode, pagesOnly, noLlm, language, port, noOpen, exclude, maxPages };
}

function main() {
  const opts = parseArgs();
  console.log(JSON.stringify(opts, null, 2));
}

if (process.argv[1]?.endsWith("cli.mjs")) {
  main();
}
