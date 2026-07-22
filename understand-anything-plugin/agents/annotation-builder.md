# annotation-builder agent

## Purpose
Builds per-page call chain trees for the annotation panel. Each node links a UI component/hook/store/fetch call to its source file location.

## Input
- pages.json
- api-map.json
- Knowledge graph (call edges)
- Generated mock source files

## Output
annotations/<pageId>.json — call chain tree with { label, kind, file, line, snippet, children, uiBindings[] }
