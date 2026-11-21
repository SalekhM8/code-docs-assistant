# BUILD.md: Code Documentation Assistant

Read this whole file before doing anything. It is the complete brief. Work through it from start to finish without waiting for the author.

## 0. Mission

Build a web app that indexes a public GitHub repo and answers questions about the code with file and line citations. It is a take home assignment for a senior AI engineering role. The reviewers value a solid, simple, well engineered solution far above a complex one. They will read the code, run it, and question every decision.

Success means: it runs with one command, the twelve journeys work, tests and evals pass, and the code is clean enough that the author can explain any file.

## 1. How to work on your own

- Work phase by phase in the order in section 9. Do not skip ahead.
- Do not wait for approval. Where this file is silent, choose the simplest option that fits and record it.
- At the start of each phase write a short plan to `docs/plans/phase-N.md`.
- At the end of each phase: run lint, typecheck and tests, fix failures, run the self review in section 10, then commit on a branch named `phase-N-name` and merge to main.
- Keep `docs/ai-log.md` up to date. One line per entry, three kinds: `ASSUMED` (a choice you made that this file did not cover), `CHANGED` (anything you did differently from this file, and why), `BLOCKED` (something you could not do).
- If blocked by something only the author can provide (section 2), do not stop. Use the fallback listed there, log it, and carry on.
- If a decision in this file is wrong in practice, pick the closest working alternative, log it as `CHANGED`, and carry on.
- Never invent features. Never add a service, framework or dependency that this file does not call for unless it is needed to meet a journey, and log it if so.
- When everything is finished, write `docs/handover.md` (section 11).

## 2. What the author provides, and the fallback if missing

| Needed | Where | Fallback |
| --- | --- | --- |
| `ANTHROPIC_API_KEY` | `.env` | Build and test everything with the fake provider. Skip real eval runs and log `BLOCKED` |
| `VOYAGE_API_KEY` | `.env` | Same as above |
| Path or URL of the White House repo | `WHITE_HOUSE_REPO` in `.env` | Build the UI with a restrained dark theme using the rules in section 8, keep all tokens in one theme file so they can be swapped later, and log `BLOCKED` |
| Review of the eval questions | After the build | Write them yourself, mark the file as unreviewed draft |

Before phase 1, check the current model ids in the Anthropic and Voyage documentation and put them in `.env.example`. Confirm the chat component library you choose is maintained.

## 3. First action

Create `CLAUDE.md` in the repo root containing sections 4, 5 and 6 of this file, word for word, plus the commands list from section 4. Copy this file to `docs/BUILD.md`.

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

## 7. What to build

### Journeys

1. Add a repo: paste a public GitHub URL, see indexing progress, then ready or a clear failure with retry
2. Get oriented: a short repo overview and suggested first questions
3. Ask a question: answer streams in with file and line citations
4. Check the answer: click a citation, code opens beside the chat with the lines highlighted
5. Follow up: conversation context is kept
6. Dead end: it says it could not find the answer and shows what it searched
7. Come back later: repos and conversations persist
8. Re index: fetch latest, only changed files are processed
9. Delete a repo or a conversation and all its data
10. Stop an answer mid stream, or regenerate it
11. Thumbs up or down, stored against the trace
12. Trace panel per answer: searches, files opened, tokens, cost, time

Reviewer journey: clone, add two API keys, `docker compose up`, and a small sample repo is indexed automatically and ready to query. Choose a small, well known, permissively licensed public repo and pin it to one commit.

Out of scope, do not build: auth, private repos, zip upload, branch selection, questions across repos, sharing, teams, billing, webhooks, editor plugin.

### Indexing flow (journey 1)

1. API validates the URL and limits, creates an `index_jobs` row, returns immediately
2. Background job does a shallow clone into a temp folder
3. Walk files and apply the skip rules
4. Chunk each file
5. Embed in batches, using the embedding cache
6. Write files and chunks under a new index version tied to the commit id
7. Swap the new version in with one transaction, remove the old version, delete the temp folder
8. Generate the repo overview and suggested questions with the cheap model
9. Mark the job ready. On failure store the reason. The web app polls job status for progress

### Chunking

- Code: tree sitter, one chunk per function, class or method. Split large classes by method
- No parser for the language, or config files: line windows with overlap
- Markdown: split by heading
- Each chunk stores path, start line, end line, symbol name, language, content hash
- Before embedding, prefix the chunk text with its path and symbol name

### Retrieval

Two modes, both kept, selected by a flag so evals can compare them.

- Baseline: one shot hybrid search, top results into one model call
- Agent: the model gets four read only tools and at most 6 steps
  - `search_code(query)` hybrid search over chunks
  - `find_symbol(name)` exact and prefix match on symbol names
  - `read_file(path, start_line, end_line)` returns a capped line range
  - `list_files(path)` directory listing

Hybrid search runs pgvector search (HNSW index) and Postgres full text search in parallel and merges them with reciprocal rank fusion.

The loop is plain code: call the model, run requested tools (in parallel when several), feed results back, stop on an answer or the step cap.

### Models

- Answers: Claude Sonnet tier. Cheap steps (overview, titles): Claude Haiku tier. Embeddings: Voyage code model
- Model ids from env variables. Providers behind interfaces. Each stored embedding records its model

### Prompts and context

- System prompt rules: answer only from retrieved code, cite every claim as path and line range, say so plainly when the answer is not found
- Order: fixed rules, tool definitions, repo overview, then conversation. Use prompt caching on the fixed part
- Token budget for tool results. Recent turns in full, older turns summarised
- Prompts live in versioned files under `prompts/`

### Guardrails

- Citation checker in code after each answer: every cited path and range must exist and must have been retrieved in that run. Failures are flagged in the UI
- No evidence means no answer
- All limits from section 6

### Data

Tables: repos, index_versions, files, chunks, index_jobs, conversations, messages, traces, trace_steps, feedback, embedding_cache.

### Caching

- Embedding cache keyed by content hash plus model name
- Index versions tied to commit id with atomic swap
- Provider prompt caching on the fixed prefix
- Frontend refetches after every mutation

### Observability

- Every answer writes a trace: steps, tool calls, tokens, cost, timings
- Optional Langfuse export when its env keys are set

### Evals

- Golden set of 30 to 40 questions on the sample repo at the pinned commit, each with expected files and key facts. Types: find a named thing, explain how something works, multi step, unanswerable, and a few prompt injection cases
- Scored in code: recall at k, MRR, citation validity
- Judged by a model: faithfulness and correctness against the key facts
- `pnpm eval` runs both retrieval modes and prints quality, cost and latency side by side, and saves the table to `docs/eval-results.md`
- Retrieval metrics run in CI

## 8. UI and design

Layout: repos and conversations on the left, chat in the centre, code viewer on the right, trace panel as a drawer.

Look and feel comes from the author's White House app at `WHITE_HOUSE_REPO`. Read its real source, do not guess. Before building screens, write `docs/design-tokens.md` and the Tailwind theme with its colours, typography, spacing, radius, shadows and glows, motion durations and easings, and how the orb worker is drawn and animated. Reuse its components where they fit.

How it applies here:

- Tokens applied to shadcn/ui components for the shell, panels, inputs and cards
- The orb is the assistant. Its state follows real stream events: idle, searching, reading a file, answering, done, failed
- A live steps list beside the orb shows each search and file open as it happens
- Indexing progress uses the same motion language

Rules:

- Every animated element shows real system state. Nothing moves for decoration alone
- Answer text and code are high contrast and still once rendered
- Respect reduced motion. Everything works with motion off
- Animation never blocks input or delays the first streamed words
- Keyboard: Enter sends, Shift Enter adds a line, Escape stops. Focus always visible
- Works at laptop width. On narrow screens the code viewer becomes a full screen sheet
- No assets, logos or copy from third party products

Frontend techniques, each used where listed:

- Streaming for answer text and live steps
- Optimistic updates for send, delete and feedback
- Debounce on the file filter in the code viewer
- Lazy loading for the code viewer and syntax highlighter
- Virtualised file tree and message list
- Stop cancels the in flight request

## 9. Phases and what done means

| Phase | Build | Done when |
| --- | --- | --- |
| 1 Skeleton | Layout, compose, schema, migrations, health check, lint, types, test setup, CI workflow | `docker compose up` starts all three and health check passes. CI is green |
| 2 Indexing | Journeys 1, 8, 9 on the API side | A fixture repo indexes, re indexes touching only changed files, and deletes cleanly, all covered by tests |
| 3 Baseline | Hybrid search, one shot answers with citations, SSE streaming, not found behaviour | A question over the API streams a cited answer. Fusion and not found paths are tested |
| 4 Evals | Golden set, runner, scorers, results table | `pnpm eval` prints baseline scores and saves them |
| 5 Agent | Tools, loop, context budget, citation checker, traces | Both modes pass tests. Eval comparison saved |
| 6 Chat UI | Design tokens, then journeys 2, 4, 5, 7, 10 | Every listed journey works in the browser |
| 7 Trace and feedback | Journeys 11, 12 | Trace panel shows real data for any answer |
| 8 Hardening | All limits, error and empty states for every journey, Playwright test | Browser test passes. Each failure case shows a clear message |
| 9 Docs | README, diagram, screenshots | See below |

README rules: write setup instructions, an architecture diagram, the env variable list, how to run tests and evals, the eval results table, and a list of known gaps and unhandled edge cases. For these sections add the heading only and leave the body empty for the author: RAG and LLM decisions, key technical decisions, engineering standards followed and skipped, how AI tools were used, what I would do differently, productionising. Under each empty heading add a hidden comment listing the relevant facts from the build, so the author can write it in their own words.

## 10. Self review after every phase

Act as a strict reviewer who did not write the code. Check the phase against sections 5 and 6. Look for rule breaks, untested logic, dead code, anything more complex than needed, and anything the author would struggle to explain. Fix what you find, then commit.

## 11. Handover

When finished, write `docs/handover.md` with:

- What works, journey by journey
- Anything not finished or blocked, and what the author must do
- A file by file map: one line per file saying what it does
- The ten places in the code a reviewer is most likely to ask about, with a short explanation of each
- Every `ASSUMED` and `CHANGED` entry from the log, grouped
- Exact steps to run it from a clean clone
