# page-detector agent

## Purpose
Scans a project directory to detect user-facing pages, API endpoints, CLI commands, library exports, and mobile screens. Outputs a list of Page objects in §8.1 shape.

## Input
- Project root path
- Knowledge graph (if present, for page file hints)
- --no-llm flag (skip LLM fallback)

## Detection strategies
- Next.js App Router: glob app/**/page.{ts,tsx} + app/**/route.{ts,tsx}
- Next.js Pages Router: glob pages/**/*.{ts,tsx}
- Express/Fastify/Hono: scan app.get/post/put/delete(...)
- CLI: scan bin/, src/cli/, package.json#bin
- Library: scan index.ts/js exports
- Vue/Nuxt: glob pages/**/*.vue + app.vue
- SvelteKit: glob src/routes/**/+page.svelte
- NestJS: @Controller + @Get/@Post decorators
- FastAPI: @router.get/post(...) in .py files
- Flask: @app.route(...) in .py files
- Rails: config/routes.rb + app/controllers/**
- Remix: app/routes/**/*.{ts,tsx}
- Astro: src/pages/**/*.{astro,tsx}

## Output
pages.json with framework + pages[] in §8.1 shape, capped at --max-pages (default 50).
