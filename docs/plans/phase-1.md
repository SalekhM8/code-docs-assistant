# Phase 1: Skeleton

Goal: `docker compose up` starts db, api and web, health check passes, CI is green.

1. pnpm workspace: `apps/web`, `apps/api`, `packages/shared`. One strict `tsconfig.base.json`. One flat ESLint config at the root.
2. `packages/shared`: zod schemas for API payloads. It starts with the health response and grows each phase.
3. `apps/api`: Hono on Node. Config is validated with zod at startup. pino JSON logs carry a request id taken from `x-request-id` or generated. `GET /health` checks the db.
4. `apps/api/src/db`: Drizzle schema for all eleven tables (section 7, Data) and a generated SQL migration. pgvector `vector(1024)` with an HNSW index, plus a `tsvector` column with a GIN index for keyword search. A migrate script runs before the server starts.
5. `apps/web`: Next.js App Router, Tailwind v4, TanStack Query provider. A placeholder three-panel shell that shows api health.
6. Tests: Vitest in each package. A db integration test helper starts a real Postgres (pgvector image) with Testcontainers.
7. Docker: one Dockerfile per app, and `docker-compose.yml` with db (`pgvector/pgvector:pg17`), api and web.
8. CI: GitHub Actions runs install, lint, typecheck and test. Testcontainers works on GitHub runners.

Not in this phase: any feature logic.
