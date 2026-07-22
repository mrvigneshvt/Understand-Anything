# understand-mock

5-phase pipeline orchestrator for the mock-page guidebook.

## Pipeline

1. **Detect pages** → `page-detector.mjs` → `.ua/mock-guide/pages.json`
2. **Map APIs** → `api-mapper.mjs` → `.ua/mock-guide/api-map.json`
3. **Generate mocks** → `mock-generator.mjs` → `.ua/mock-guide/mocks/*.tsx`
4. **Build annotations** → `annotation-builder.mjs` → `.ua/mock-guide/annotations/*.json`
5. **Serve guidebook** → `next dev -p <port>` → `http://127.0.0.1:<port>/?token=…`

## Resolving PROJECT_ROOT + UA_DIR

Follows the understand-dashboard pattern:
- `PROJECT_ROOT` = the project directory passed as argument (default: cwd)
- `UA_DIR` = `.ua/` (or legacy `.understand-anything/` if it exists)
- All output goes under `<PROJECT_ROOT>/<UA_DIR>/mock-guide/`

For monorepo projects (apps/web, apps/api), running from the root detects
sub-apps and scopes each guidebook to `<app-dir>/<UA_DIR>/mock-guide/`.

## Usage

```bash
/understand-mock [projectDir] [flags]
```

## Flags

| Flag | Type | Default | Description |
|------|------|---------|-------------|
| `--mode` | string | `structural` | Mock generation mode: `structural`, `screenshot`, `template` |
| `--pages-only` | boolean | `false` | Only run page-detector, print pages.json summary, skip everything else |
| `--no-llm` | boolean | `false` | Deterministic-only path — no LLM calls in any agent |
| `--language` | string | — | Hint for page-detector (e.g. `ts`, `py`, `go`) |
| `--port` | number | `5174` | Port for the dev server |
| `--no-open` | boolean | `false` | Don't auto-open the browser |
| `--exclude` | string | — | Gitignore-syntax exclusion patterns (comma or space separated) |

## Exit States (§9)

- **Success**: prints `✓ Mock guide ready at http://127.0.0.1:<port>/?token=…` (exit 0)
- **No pages**: prints `✗ No pages detected in <projectDir>` (exit 1)
- **LLM unavailable with --no-llm**: prints `✗ --no-llm set but LLM required for this project's page detection` (exit 1)
