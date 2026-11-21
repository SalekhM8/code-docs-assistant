# Handover

Built from `docs/BUILD.md`, phase by phase. Each phase was merged to `main` from a `phase-N-*` branch with lint, types and tests green. The final counts are 98 api tests, 8 web tests, 1 shared test, and 2 Playwright tests. The decision log is `docs/ai-log.md`.

## What works, journey by journey

All twelve journeys were exercised in a browser with the fake providers (Playwright journey test, plus screenshots), and every API path has integration tests on real Postgres.

| # | Journey | State | Where it is proven |
| --- | --- | --- | --- |
| 1 | Add a repo, progress, ready or clear failure with retry | Works | `test/indexing.test.ts`; e2e (seeded repo); screenshots of progress and the bad-URL error |
| 2 | Overview and suggested questions | Works (cheap model, with a fallback summary) | `indexing/overview.test.ts`; e2e |
| 3 | Streamed answer with file:line citations | Works | `test/answer.test.ts`, `test/agent.test.ts`; e2e |
| 4 | Citation opens the code beside the chat, lines highlighted | Works (full-screen sheet on narrow screens) | e2e; `answer-and-code.png` |
| 5 | Follow-up keeps context | Works (last 6 turns in full, older summarised) | `answer.test.ts` "keeps conversation context" |
| 6 | Dead end: says so and shows what it searched | Works (enforced in code) | `answer.test.ts`, `agent.test.ts`, `agent-unit.test.ts` |
| 7 | Repos and conversations persist | Works | e2e reload step |
| 8 | Re-index processes only changed files | Works | `indexing.test.ts` "re-indexes only changed files" |
| 9 | Delete a repo or conversation and all its data | Works | `indexing.test.ts`, `answer.test.ts` (row counts go to zero); e2e |
| 10 | Stop mid stream, regenerate | Works (partial answer stored as stopped) | `answer.test.ts`; e2e (Escape, then Regenerate) |
| 11 | Thumbs up or down stored against the trace | Works | `test/traces.test.ts`; e2e |
| 12 | Trace panel: searches, files, tokens, cost, time | Works (from stored steps) | `traces.test.ts`; e2e; `trace.png` |

## Not finished or blocked, and what you must do

1. **Add API keys and run the real evals.** Put `ANTHROPIC_API_KEY` and `VOYAGE_API_KEY` in `.env` (and set `LLM_PROVIDER=anthropic`, `EMBEDDING_PROVIDER=voyage`), then run `pnpm eval`. This fills in the baseline vs agent table in `docs/eval-results.md`. Copy the numbers into the README's eval section. The current numbers are fake-embedding retrieval only.
2. **Run `docker compose up --build` once.** Docker Desktop would not start on the build machine, so the compose file, both Dockerfiles and the Testcontainers path were written but never executed here. The api and web were run directly instead, and tests used a local Postgres 18 + pgvector. Watch for:
   - the web build fetching Google Fonts (needs network)
   - `pnpm install --prod` in the api image
3. **Review the golden set** (`apps/api/src/evals/golden-set.json`, `"reviewed": false`). The drafter's three least-sure items are explain-08, unanswerable-04 and multi_step-02. Flip `reviewed` to true when done.
4. **Push and check CI.** The workflow has three jobs: `check` (lint, types, and tests including Testcontainers), `retrieval-eval` and `e2e`. None has run yet.
5. **Langfuse** export is written to its OTLP endpoint but has never been sent to a live project.
6. **Write the README sections left for you.** Each empty heading has the facts in a hidden comment.
7. **Clean up local tooling.** The build installed `pgvector` and `postgresql@18` with Homebrew. A throwaway Postgres runs from the session scratchpad on port 55440, and `.env` points at it. To stop it: `/opt/homebrew/opt/postgresql@18/bin/pg_ctl -D <scratchpad>/pgdata stop`. To remove the packages: `brew uninstall pgvector postgresql@18`.

## File map

Root
- `package.json`: workspace scripts (`test`, `lint`, `typecheck`, `eval`, `e2e`).
- `pnpm-workspace.yaml`: workspace packages and the dependencies allowed to run build scripts.
- `tsconfig.base.json`: the shared strict TypeScript settings.
- `eslint.config.js`: one flat ESLint config (no `any`, no non-null assertions, React hooks).
- `docker-compose.yml`: db (pgvector), api and web, with health checks.
- `.env.example`: every environment variable, with comments.
- `.github/workflows/ci.yml`: lint, types and tests; the retrieval eval floor; the Playwright test.
- `.nvmrc`, `.npmrc`, `.gitignore`, `.dockerignore`: Node version, pnpm settings, ignores.
- `CLAUDE.md`: brief sections 4 to 6, word for word.
- `README.md`: setup, architecture, environment variables, tests, evals, gaps.

docs
- `docs/BUILD.md`: the brief.
- `docs/ai-log.md`: every ASSUMED, CHANGED and BLOCKED decision.
- `docs/design-tokens.md`: the theme and orb, each value traced to the White House source.
- `docs/design/source-notes.md`: the raw token extraction, with file:line for each value.
- `docs/eval-results.md`: the latest `pnpm eval` output.
- `docs/plans/phase-N.md`: the plan written at the start of each phase.
- `docs/screenshots/*`: the README screenshots.

packages/shared (zod contracts used by both apps)
- `src/index.ts`: re-exports everything.
- `src/health.ts`: the `/health` response.
- `src/errors.ts`: the error body every non-2xx response uses.
- `src/repos.ts`: repo, job, stages and progress.
- `src/chat.ts`: messages, citations, conversations, ask and regenerate requests, live steps, and the SSE event union.
- `src/files.ts`: file list and file content for the code viewer.
- `src/traces.ts`: trace detail, steps and feedback.
- `src/health.test.ts`: a schema smoke test.

apps/api
- `Dockerfile`: Node 22 slim with git; runs `src/main.ts` with tsx.
- `drizzle.config.ts`, `drizzle/0000_extensions.sql` (enables pgvector), `drizzle/0001_init.sql` (the generated schema).
- `vitest.config.ts`: test config; only `TEST_*` variables from `.env` reach tests.
- `src/main.ts`: start-up: config, migrations, fail interrupted jobs, build services, serve, seed, graceful shutdown.
- `src/app.ts`: the Hono app: CORS, request id, body limit, rate limit, error handler, routes.
- `src/config.ts`: environment schema, validated at start-up.

src/lib
- `lib/errors.ts`: `AppError` codes with HTTP statuses and user-facing messages.
- `lib/http.ts`: request-id and logger middleware, error handler, zod body and param parsing.
- `lib/logger.ts`: the pino JSON logger, with redaction.
- `lib/rate-limit.ts`: a per-client, one-minute fixed-window limiter.
- `lib/text.ts`: sha256, identifier splitting, line count, token estimate.

src/db
- `db/schema.ts`: Drizzle schema for the 11 tables, the HNSW and GIN indexes, and the `tsvector` type.
- `db/client.ts`: the postgres-js and Drizzle connection.
- `db/migrate.ts`: runs migrations, at start-up or from the CLI.

src/providers
- `providers/llm.ts`: the provider-neutral model interface (turns, tools, usage).
- `providers/anthropic.ts`: the Claude implementation: streaming, tools, prompt-cache blocks, refusal fallbacks, error mapping.
- `providers/fake-llm.ts`: the scriptable fake for tests, with a "search then cite" default for key-less runs.
- `providers/embeddings.ts`: the embedding interface, the Voyage REST client (with retries) and the hashed fake.
- `providers/pricing.ts`: per-model token prices, used for trace cost.
- `providers/index.ts`: picks real or fake providers from config.

src/indexing
- `indexing/github.ts`: URL parsing (github.com only), the GitHub metadata check, size and private limits.
- `indexing/clone.ts`: a hardened shallow `git` clone, or a single-commit fetch.
- `indexing/file-filter.ts`: skip rules: ignored directories, lock files, secrets (by name and content), binaries, minified and oversized files.
- `indexing/languages.ts`: extension to language and chunking strategy.
- `indexing/walk.ts`: walks the clone, applies the skip rules and file and size limits, hashes content.
- `indexing/chunkers/types.ts`: the chunk shape and line helpers.
- `indexing/chunkers/code.ts`: the tree-sitter chunker (definitions, doc comments, splitting classes by method).
- `indexing/chunkers/markdown.ts`: splits by heading, ignoring code fences.
- `indexing/chunkers/lines.ts`: overlapping line windows.
- `indexing/chunkers/index.ts`: picks a chunker per file, and builds the text that gets embedded.
- `indexing/embed.ts`: batching, and the embedding cache read and write.
- `indexing/store.ts`: versions, the unchanged-file copy, file and chunk inserts, the weighted tsvector, the atomic swap.
- `indexing/overview.ts`: repo overview and questions from the cheap model, with a fallback.
- `indexing/pipeline.ts`: runs one index job stage by stage and records progress and failures.

src/retrieval
- `retrieval/types.ts`: retrieved and scored chunk shapes.
- `retrieval/vector.ts`: pgvector cosine search with iterative HNSW scan.
- `retrieval/keyword.ts`: question to OR tsquery, then ranked full-text search.
- `retrieval/fusion.ts`: reciprocal rank fusion.
- `retrieval/hybrid.ts`: vector, keyword and hybrid retrievers.

src/agent
- `agent/run-context.ts`: everything one answer run needs, and the traced model-turn helper.
- `agent/baseline.ts`: baseline mode: one hybrid search, then one model call.
- `agent/loop.ts`: agent mode: the plain tool loop with step, token and budget caps.
- `agent/tools.ts`: the four read-only tools, input validation, path normalising.
- `agent/budget.ts`: the append-only character budget for tool output.
- `agent/context.ts`: line numbering, chunk formatting, history window.
- `agent/evidence.ts`: what the run was shown, and searched.
- `agent/citations.ts`: citation parser and checker.
- `agent/finalize.ts`: "no evidence means no answer" and status decisions.

src/prompts
- `prompts/untrusted.ts`: the rule for untrusted repo data, and the `<repo_data>` wrapper.
- `prompts/answer.v1.ts`: answer rules, the baseline and agent system prompts, `NOT_FOUND`.
- `prompts/overview.v1.ts`: the overview prompt.
- `prompts/conversation.v1.ts`: title and summary prompts.
- `prompts/judge.v1.ts`: the eval judge prompt.

src/services
- `services/container.ts`: the single composition root.
- `services/repos.ts`: add, list, get, re-index and delete repos; status derivation.
- `services/index-runner.ts`: the in-process job runner (concurrency 2, cancel, idle); fails interrupted jobs.
- `services/seed.ts`: indexes the pinned sample repo on first start.
- `services/conversations.ts`: conversations and messages, history, title and summary after answers.
- `services/answer.ts`: orchestrates one answer: emits events, runs the mode, finalises, persists message and trace.
- `services/trace.ts`: `TraceRecorder`: timed steps, usage, cost, save.
- `services/traces.ts`: reads a trace; feedback upsert and clear.
- `services/files.ts`: file list and content for the code viewer.
- `services/langfuse.ts`: optional OTLP export of traces to Langfuse.

src/routes
- `routes/health.ts`: `GET /health` with a db check.
- `routes/repos.ts`: repo CRUD and re-index.
- `routes/conversations.ts`: conversations, and the SSE `messages` and `regenerate` endpoints with abort handling.
- `routes/files.ts`: file list and content.
- `routes/traces.ts`: trace detail and feedback.

src/evals
- `evals/golden-set.json`: 34 questions with expected files, key facts and line evidence.
- `evals/golden.ts`: golden-set schema and loader.
- `evals/scorers.ts`: recall@k, MRR, citation validity, mean, percentile.
- `evals/retrieval-eval.ts`: vector vs keyword vs hybrid metrics.
- `evals/answer-eval.ts`: one question through the real pipeline, scored in code and by the judge.
- `evals/judge.ts`: model-graded correctness and faithfulness against the cited code.
- `evals/report.ts`: markdown tables for `docs/eval-results.md`.
- `evals/run.ts`: the `pnpm eval` CLI.

Tests
- `*.test.ts` beside the source: unit tests for the module next to them.
- `test/helpers/db.ts`: a migrated test database (Testcontainers, or `TEST_DATABASE_URL`).
- `test/helpers/app.ts`: test app with fakes, `FixtureCloner`, SSE helpers.
- `test/fixtures/sample-repo/*`: a tiny repo (TS, Python, markdown, YAML) used by the integration tests.
- `test/health.test.ts`: health, request id, body limit.
- `test/indexing.test.ts`: index, skip rules, re-index, cache, failure and retry, delete, URL validation.
- `test/answer.test.ts`: baseline SSE, citation flags, not found, follow-ups, stop, regenerate, title, guards, delete.
- `test/agent.test.ts`: parallel tools, step cap, bad tool calls, narration reset, evidence rules.
- `test/files.test.ts`: file routes.
- `test/traces.test.ts`: trace detail and feedback.

apps/web
- `Dockerfile`: Next standalone build, with the api URL as a build argument.
- `next.config.ts`: standalone output, transpiles the shared package.
- `playwright.config.ts`: starts its own api and web servers for the browser test.
- `e2e/journeys.spec.ts`: the reviewer journey, plus the add-repo error.
- `components.json`: shadcn/ui config.
- `AGENTS.md`: written by `next dev`.
- `postcss.config.mjs`, `vitest.config.ts`, `tsconfig.json`, `next-env.d.ts`: tooling.

apps/web/src/app
- `app/layout.tsx`: root layout, fonts, providers.
- `app/globals.css`: base styles, focus ring, reduced-motion rule.
- `app/theme.css`: every design token, mapped onto shadcn's variables.
- `app/orb.css`: the orb's states and intensity curves.
- `app/not-found.tsx`: the 404 page.
- `app/(shell)/layout.tsx`: wraps pages in the app shell.
- `app/(shell)/error.tsx`: the error boundary.
- `app/(shell)/page.tsx`: home.
- `app/(shell)/repos/[repoId]/page.tsx`: the repo page.
- `app/(shell)/repos/[repoId]/c/[conversationId]/page.tsx`: a conversation.

apps/web/src/lib
- `lib/env.ts`: validates the api URL.
- `lib/api.ts`: the typed client for every endpoint, with request ids and `ApiError`.
- `lib/queries.ts`: TanStack Query hooks; optimistic delete and feedback; polling while indexing.
- `lib/sse.ts`: incremental SSE parser.
- `lib/stream-answer.ts`: POSTs a question and streams events, with abort support.
- `lib/live-answer.ts`: orb states and the reducer from stream events to the live answer.
- `lib/citations.ts`: turns citations into links and parses them back.
- `lib/trace-view.ts`: summarises a trace into searches, files and totals.
- `lib/repo-status.ts`: stage labels and the progress percentage.
- `lib/pending-question.ts`: hands a question from the repo page to its new conversation.
- `lib/fonts.ts`: Fraunces and Inter.
- `lib/utils.ts`: the `cn` class helper.
- Tests: `*.test.ts` beside each file.

apps/web/src/hooks
- `hooks/use-answer-stream.ts`: one in-flight answer: optimistic send, stream, stop, regenerate, cache writes.
- `hooks/use-debounced.ts`: debounced value (the file filter).
- `hooks/use-media-query.ts`: media query subscription (the layout switch).

apps/web/src/components
- `components/providers.tsx`: query client, tooltips, panels.
- `components/panels.tsx`: code viewer and trace drawer state.
- `components/orb.tsx`: the orb with its text label.
- `components/eyebrow.tsx`: house eyebrow and headline.
- `components/trace-drawer.tsx`: the trace panel.
- `components/shell/app-shell.tsx`: the White House layout: 3D floor behind floating cards, Places, chat panel on the right, code viewer over the floor; narrow-screen sheets.
- `components/shell/places.tsx`: the house's Places card: repos as floors, conversations as rooms, the add-repo form.
- `components/shell/top-bar.tsx`: breadcrumb pill, Working/Ready/Failed counts, the dark action pill (Stop answering while streaming).
- `components/shell/stage-host.tsx`: picks the floor for the page (repos, or a repo's folders) and the hint pill; loads three.js lazily.
- `components/scene/stage.tsx`: the Canvas, camera framing between the panels, room-label layer.
- `components/scene/floor-scene.tsx`: rooms, storeys, signs and the walking assistant, adapted from the house's FloorScene.
- `components/scene/person.tsx`: the house's blocky person, copied.
- `components/scene/scene-boundary.tsx`: drops the floor quietly without WebGL.
- `components/activity.tsx`: shares the open conversation's live answer with the floor and the top bar.
- `components/panel-header.tsx`: the side panel's eyebrow and Fraunces headline, and the ghost-pill chip.
- `lib/floor.ts`: folders to rooms, room states from steps and citations, where the assistant stands.
- `components/shell/api-status.tsx`: the api or db down banner.
- `components/sidebar/add-repo-form.tsx`: the URL form with its errors.
- `components/sidebar/confirm-button.tsx`: inline two-step delete.
- `components/repo/home.tsx`: the empty state.
- `components/repo/repo-home.tsx`: overview, suggested questions, failure and retry, composer.
- `components/repo/indexing-progress.tsx`: stage, files and chunks, progress bar.
- `components/chat/chat-view.tsx`: a conversation page.
- `components/chat/message-list.tsx`: the virtualised list that sticks to the bottom.
- `components/chat/message.tsx`: user, answer, dead-end, failed and stopped messages.
- `components/chat/message-actions.tsx`: thumbs and the Trace button.
- `components/chat/live-answer.tsx`: the streaming view.
- `components/chat/live-steps.tsx`: the live steps list.
- `components/chat/markdown.tsx`: answer markdown with citation chips.
- `components/chat/citation-chip.tsx`: a clickable citation with its checker verdict.
- `components/chat/composer.tsx`: question input, keyboard handling, Stop, mode switch.
- `components/code/code-panel.tsx`: the lazily loaded code viewer (file and browse modes).
- `components/code/code-view.tsx`: numbered lines, highlighted range, scroll into view.
- `components/code/file-tree.tsx`: virtualised file list with a debounced filter.
- `components/code/highlight.ts`: lazy shiki tokenising.
- `components/ui/*`: shadcn/ui primitives (button, input, textarea, sheet, tooltip), restyled through the theme.

## Ten places a reviewer will ask about

1. **`agent/citations.ts` and `agent/finalize.ts`: the citation guardrail.**
   - A citation is valid only if the file is in this index version, the lines exist, and the range overlaps something the run actually retrieved or read (`agent/evidence.ts`).
   - A `NOT_FOUND:` reply, an empty retrieval or zero valid citations is stored as `not_found` with the searches listed.
   - This is "no evidence means no answer" enforced in code, not only in the prompt.
2. **`agent/loop.ts`: the agent loop.**
   - About 30 lines of plain code. Call the model, run tool calls in parallel, append the results, repeat.
   - Step 6, an exhausted tool budget or the token cap forces `tool_choice: none`.
   - Narration text before tool calls is cleared with a `reset` event. History is append-only, which keeps prompt caching and replayed thinking blocks valid.
3. **`retrieval/hybrid.ts`, `vector.ts`, `keyword.ts`, `fusion.ts`: hybrid search.**
   - Vector and full-text searches run in parallel, 30 candidates each, merged by reciprocal rank fusion. RRF uses ranks only, so cosine distance and `ts_rank` never need putting on one scale.
   - pgvector `iterative_scan` stops the per-version filter from starving HNSW results.
   - Full text splits identifiers and weights path and symbol above the body. The eval shows each piece earning its keep.
4. **`indexing/pipeline.ts` with `store.ts`: versions and incremental re-index.**
   - A new version is built beside the live one, then swapped in by one transaction that also deletes the old version (cascade).
   - Unchanged files (same path and hash) are copied with their vectors by two `INSERT ... SELECT` statements, so only changed files are chunked and embedded.
   - The embedding cache catches identical chunks anywhere else.
5. **`indexing/chunkers/code.ts`: tree-sitter chunking.**
   - Unwraps exports, decorators and `const f = () => {}`, and attaches leading doc comments.
   - Splits classes over 150 lines into `Class.method` chunks, and windows anything still too long.
   - Code between definitions becomes `module` chunks, so nothing is dropped (a bug the tests caught).
6. **`routes/conversations.ts` with `services/answer.ts`: streaming and Stop.**
   - SSE via Hono's `streamSSE`. A client disconnect aborts an `AbortController` that reaches the SDK call.
   - The run then stores the partial text as `stopped`, and the client re-syncs until it sees it (`hooks/use-answer-stream.ts`).
   - Readiness is checked before the stream opens, so those errors are plain JSON.
7. **`providers/llm.ts`, `anthropic.ts`, `fake-llm.ts`: provider interfaces.**
   - Everything talks to `LlmProvider` and `EmbeddingProvider`. Tests script the fake turn by turn; key-less runs use its default behaviour.
   - The Anthropic adapter is the only file that knows SDK types: cache breakpoints, strict tools, server-side refusal fallbacks, typed error mapping.
8. **`prompts/untrusted.ts` and `answer.v1.ts`: prompt injection.**
   - All repo text (search results, files, README in the overview) is wrapped in `<repo_data>`, with closing tags escaped.
   - Every system prompt says that content is data, never instructions.
   - Tools are read-only, scoped to one version, and path-normalised. Injection cases are in the golden set.
9. **`services/trace.ts`: traces and cost.**
   - Every retrieval, tool and model call is timed and recorded with usage, and cost is computed from `providers/pricing.ts`.
   - Step outputs hold refs, not file contents.
   - Feedback joins on the trace id, the trace panel reads the same rows, and the eval scores recall from the same refs.
10. **`evals/`: how quality is measured.**
    - Retrieval metrics are pure code with no model calls, and run in CI with a floor.
    - Answer metrics run both modes through the real pipeline: file recall and MRR from trace refs, citation validity from the checker, and correctness and faithfulness from a judge that sees only the cited code.
    - Cost and latency come from traces. Known weakness: the judge is the same model family, and the golden set is unreviewed.

## Decisions from the AI log

### Changed from the brief

- Node 22 instead of the machine default 20. Testcontainers 12 depends on undici 8, which needs Node 22.
- the citation checker (listed under phase 5) was built in phase 3, because the phase 3 "not found" behaviour and "no evidence means no answer" depend on it.
- prompt order. The brief says rules, tool definitions, overview, conversation; the Anthropic API always renders tools before system, so the cached prefix is tools, rules, overview, then conversation. Both system blocks carry a cache breakpoint.
- keyword search weights path and symbol (A) above body text (D). Measured on the golden set with the fake embedder: keyword Recall@5 went from 24.4% to 32.8%, hybrid Recall@5 from 46.1% to 51.1%, and hybrid MRR@10 from 0.328 to 0.344.
- the Langfuse export posts OTLP/HTTP JSON to Langfuse's OpenTelemetry endpoint, because Langfuse marks its `/api/public/ingestion` batch API as legacy. It has no SDK dependency and sends ids, names, refs and token counts only. BLOCKED: not run against a live Langfuse project (no keys).
- the UI is a warm light theme, not the dark fallback in section 2. The White House code (the "real source" section 8 asks for) is cream and warm; only its brief describes a dark night scene. All tokens sit in one file (`apps/web/src/app/theme.css`) and can be swapped.
- no chat component library. The stream carries custom events (steps, orb states, reset, checked citations), and the message list must be virtualised. Libraries checked (assistant-ui, AI Elements, prompt-kit) each assume their own message model or runtime and would have added an adapter layer. The chat is about six small components on top of shadcn/ui primitives.

### Assumed (the brief was silent)

- `WHITE_HOUSE_REPO` is not set, but the author's White House app was found locally (`~/Ventures/palmer-clone`: house UI in `src/components/house3d`, design brief in `white-house/BRIEF.md`). Design tokens are read from that source. Its marketing pages copy a third-party site, so nothing is taken from them.
- model ids checked on 2026-11-21. Answers `claude-sonnet-5-5`, cheap steps `claude-haiku-5-5`, embeddings `voyage-code-4` (1024 dims).
- sample repo is `tj/commander.js` (MIT, ~220 files, well known) pinned to v15.1.0, commit `a5a7dc084d4d2b7932e85ca049c5204e50a2c721`. Its large `Command` class exercises split-by-method chunking.
- TypeScript 5.9, not 7.0. 7.0 (the Go port) shipped days ago and typescript-eslint, Next and drizzle-kit are not confirmed on it.
- all packages use bundler module resolution with extensionless imports. The api runs TypeScript directly with `tsx` in dev and in the container, so there is no separate build step and `packages/shared` is consumed as source by both apps.
- the browser calls the api directly (CORS, `NEXT_PUBLIC_API_URL`) rather than through a Next.js proxy, so Server Sent Events are never buffered by a middle layer.
- `apps/api/drizzle/0000_extensions.sql` is a hand-written migration that enables pgvector; `0001_init.sql` is generated by drizzle-kit from `src/db/schema.ts`.
- the tree-sitter runtime and grammars come from `@vscode/tree-sitter-wasm` (MIT, maintained by the VS Code team, one package with a matched runtime and 15 grammars). Languages without a grammar there use line windows.
- chunk limits are 150 lines per chunk (larger classes are split by member, larger functions into overlapping windows), and 60-line windows with 10 lines of overlap for config and unparsed files.
- keyword search indexes path, symbol and content, plus identifiers split into words (`parseOptions` -> `parse options`), using the `simple` text search config, because English stemming hurts code identifiers.
- the GitHub REST API (unauthenticated, optional `GITHUB_TOKEN`) is called once per add to enforce public-only and the size limit before cloning. Clones disable symlinks and allow only https.
- the fake embedder is feature-hashed bag of identifier words, so key-less runs and tests still get meaningful vector similarity.
- adding a URL that already exists returns that repo (and retries it if its last attempt failed) rather than an error.
- "no evidence means no answer" is enforced in code. An empty retrieval skips the model call, and a `NOT_FOUND:` reply or an answer with zero valid citations is stored with status `not_found` and replaced by a plain statement. The searches made are kept on the message.
- retrieved chunks are shown to the model with line numbers (`41| code`) so it can cite exact ranges.
- for baseline follow-ups of eight words or fewer, the previous question is added to the retrieval query; the agent mode handles follow-ups itself.
- the conversation title and rolling summary are made by the cheap model after an answer finishes, so they never delay the first streamed words. The last six turns are sent in full.
- the Sonnet answer tier uses effort `medium` and server-side refusal fallbacks (`fallbacks: "default"`, beta `server-side-fallback-2026-07-01`); the Haiku cheap tier uses effort `low`. Thinking is left at the model default (adaptive).
- rate limiting is in memory, per client address, one-minute fixed windows, applied to add-repo and answer calls only.
- the golden set (34 questions) was drafted by an AI sub-agent from the commander.js source at the pinned commit, with line evidence for each fact. It is marked `"reviewed": false`. The three facts it was least sure of are explain-08 (DualOptions and negated options), unanswerable-04 (`'config'` is a real option-value source, so a strict grader may mark down a careful answer) and multi_step-02 (the order of help hooks).
- prompt-injection eval cases are injected through the user question. Repo-side injection is not in the golden set, because the sample repo is pinned and has none; the defence (wrapping and labelling repo text) is covered by unit tests.
- the judge is the answer-tier model with a versioned prompt (`judge.v1`). Correctness is the share of key facts present; faithfulness is the share of claims backed by the cited code, and the judge sees only the cited code. A model judging its own family is biased; this is listed as a known gap.
- the CI floor is hybrid Recall@10 >= 0.6 with the fake embedder (measured 0.661, deterministic), so a retrieval regression fails the build.
- the context budget for tool output is append-only: about 140k characters per answer, 16k per result, with later results truncated and a note added. Earlier tool results are never rewritten, which keeps the prompt-cache prefix valid and keeps replayed thinking blocks attached to an unedited history. "Older turns summarised" applies to conversation turns, not tool results.
- the token cap per answer (`MAX_TOKENS_PER_ANSWER`, default 120k, counting input, output and cache tokens) and an exhausted tool budget both force the next step to answer with `tool_choice: none`, as the sixth step is.
- tool inputs are small, so `eager_input_streaming` is not used. Inputs are buffered, validated by the API (strict tools) and validated again with zod.
- text the model writes before tool calls is narration. The client is told to clear it (a `reset` event) so only the final step's text is the answer.
- no animation library. Every animation is CSS (the orb, the progress bar, transitions) using the house's easing and durations; the house's `motion` package is not needed for this.
- answers use Sans 15px rather than the house's Serif 21px, because code answers are full of lists, identifiers and code. Serif is kept for headlines.
- the assistant's colour is the house's Data department blue (`#2f8fe8`). Amber, red and green keep their house meanings only: not found and stopped, failed, done.
- destructive actions use an inline "Delete? Yes / No", not a browser dialog.
- a question asked on the repo page creates a conversation, navigates to it, and is sent from there (handed over in memory for that one navigation).
- the code viewer renders the whole file (2,700 lines is fine); shiki is imported on first use, and files over 400k characters stay unhighlighted.
- feedback is one rating per trace (a unique index) and can be changed or cleared. Clicking the active thumb clears it.
- the trace panel derives "searches made" and "files opened" from the stored trace steps (their inputs and `refs`), so it shows exactly what was recorded, never client-side guesses.
- the browser test seeds the real pinned sample repo, so it needs network access to GitHub, the same as the reviewer flow. It uses fake providers, its own database (`E2E_DATABASE_URL`) and ports 8788 and 3100.
- `FAKE_STREAM_DELAY_MS` (fake model only) slows the fake stream so Stop can be tested in a browser; it is 0 by default.
- request bodies are capped at 64 KB. The answer and add-repo routes are rate limited per client.
- after Stop, the web app keeps its optimistic partial answer and re-fetches briefly until the server has saved it, because the server only saves once it notices the closed connection.
- `apps/web/AGENTS.md` is written by `next dev` (Next.js 16) and is committed as generated, so the working tree stays clean.

### Blocked

- no `.env`, so no `ANTHROPIC_API_KEY` or `VOYAGE_API_KEY`. Everything is built and tested with the fake providers; real eval runs are skipped until keys are added.
- Docker Desktop would not start on the build machine. `docker compose up` and the Testcontainers path were written but could not be run here. For local runs, integration tests use `TEST_DATABASE_URL` (a throwaway Postgres 18 + pgvector 0.8.7 from Homebrew); each test file creates and drops its own database. CI uses Testcontainers.
- answer-quality evals (baseline vs agent: correctness, faithfulness, cost, latency) need `ANTHROPIC_API_KEY` and `VOYAGE_API_KEY`. `pnpm eval` runs retrieval metrics with the fake embedder and states that the answer part was skipped. Run `pnpm eval` with keys to fill in `docs/eval-results.md`.
- the phase 5 eval comparison (baseline vs agent answer quality) needs real model keys; the runner and table are ready (`pnpm eval`).

## Run it from a clean clone

With Docker (the reviewer path):

```bash
git clone <repo-url> code-docs-assistant && cd code-docs-assistant
cp .env.example .env
# edit .env: set ANTHROPIC_API_KEY and VOYAGE_API_KEY
#   (or set LLM_PROVIDER=fake and EMBEDDING_PROVIDER=fake to run with no keys)
docker compose up --build
# open http://localhost:3000; the sample repo (commander.js @ a5a7dc0) indexes itself, which takes under a minute
```

Without Docker (Node 22, pnpm 10, Postgres with pgvector):

```bash
pnpm install
cp .env.example .env              # set DATABASE_URL, the keys or the fake providers, SEED_SAMPLE_REPO=true
pnpm --filter @cda/api dev        # migrates, seeds, serves :8787
pnpm --filter @cda/web dev        # serves :3000
```

Checks:

```bash
pnpm lint && pnpm typecheck && pnpm test     # TEST_DATABASE_URL, or Docker for Testcontainers
E2E_DATABASE_URL=postgres://... pnpm e2e     # browser test; needs that database to exist
pnpm eval                                    # results saved to docs/eval-results.md
```
