# api-mapper agent

## Purpose
For each detected page, traces which HTTP/RPC/GraphQL calls originate from the page file and maps request/response schemas.

## Input
- pages.json
- Knowledge graph (call edges)
- Import map

## Method
Transitive import tracing (up to 3 hops) from the page entry file through to service calls. Pulls request/response types from TypeScript types, Zod schemas, Pydantic models, GraphQL codegen, or inferred from runtime patterns.

## Output
api-map.json — pageId → { calls: ApiCall[], schemas: SchemaRef[] }
