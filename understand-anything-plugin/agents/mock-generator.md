# mock-generator agent

## Purpose
Generates self-contained mock components with seeded data for each detected page. Produces .tsx files that import ONLY from react, MockDataProvider, and inlined constants.

## Input
- pages.json
- api-map.json
- Source files for each page

## Modes
- structural: parse JSX/Vue/Astro, replace dynamic data with seeded values (default for non-runnable projects)
- screenshot: boot real app via Playwright, capture rendered tree (default for buildable web apps)
- template: fit one of 6 page-type templates (Login, List, Detail, Form, Dashboard, Settings)

## Output
- mocks/<pageId>.tsx — self-contained mock component with inlined seed data
- seed/<pageId>.json — deterministic seed data per page type
