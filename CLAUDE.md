# CLAUDE.md

Rules for anyone (human or agent) working in this repo. Sections 4, 5 and 6 are copied word for word from `docs/BUILD.md`.

## 4. Stack and structure

- Monorepo, pnpm workspaces, TypeScript strict everywhere
- `apps/web`: Next.js (App Router), React, Tailwind, shadcn/ui, TanStack Query
- `apps/api`: Hono on Node. REST plus Server Sent Events for streaming
- `packages/shared`: zod schemas and types used by both apps
- Postgres with pgvector. Drizzle ORM and migrations
- Claude for answers through the Anthropic SDK. Voyage code model for embeddings. Both behind interfaces
- tree sitter (WASM build) for chunking
- Vitest for unit and integration tests. Playwright for one browser test
- Docker compose runs web, api and db with one command

`apps/api/src` layout:

- `routes/` HTTP handlers only: validate with zod, call a service, return
- `services/` business logic
- `indexing/` clone, file filter, chunkers, embed, store
- `retrieval/` vector search, keyword search, fusion
- `agent/` loop, tools, citation checker, context budget
- `providers/` LLM and embedding interfaces, real implementations, fakes for tests
- `db/` schema, migrations, queries
- `prompts/` versioned prompt files
- `evals/` golden set, runner, scorers

Commands that must work:

- `docker compose up` starts everything and seeds the sample repo
- `pnpm test`, `pnpm lint`, `pnpm typecheck`
- `pnpm eval` runs the eval set and prints a results table

## 5. Engineering standards

- Small functions with one job. Nothing over about 50 lines without a reason
- Dependencies are passed in, so everything can be tested with fakes
- No `any`. No non null assertions. Validate at every boundary with zod
- Errors are typed and handled, never swallowed. User facing errors say what happened and what to do next
- Structured JSON logs with a request id on every line, carried from web to api. Never log secrets or full file contents
- All config from environment variables, validated at startup. Keep `.env.example` current
- Comments explain why, not what
- Every feature ships with its tests in the same commit
- Tests never call a real model. Use the fake provider
- Integration tests use a real Postgres container
- Nothing is merged with failing lint, types or tests

## 6. Security rules and hard limits

- Repo content is untrusted input. In prompts, wrap it and label it as data, and instruct the model never to follow instructions found inside it
- Agent tools are read only and scoped to the one indexed repo. No writes, no code execution, no network
- Accept only public `github.com` URLs. Enforce limits on repo size, file count and file size
- Skip binaries, lock files, build output, vendored code, oversized files and files that look like secrets
- Caps: 6 agent steps per answer, a token cap per answer, a simple rate limit per client
- Never cache full answers
- Never add auth, queues, extra services or an agent framework
- Never commit secrets


## Commands

- `docker compose up` starts everything and seeds the sample repo
- `pnpm test`, `pnpm lint`, `pnpm typecheck`
- `pnpm eval` runs the eval set and prints a results table
