# Phase 4: Evals

1. Golden set `apps/api/src/evals/golden-set.json`: 34 questions on commander.js at the pinned commit (find, explain, multi-step, unanswerable, prompt injection). Each has expected files, key facts and verified line evidence. It is marked as an unreviewed draft.
2. Retrieval eval, scored in code with no model calls: vector only, keyword only and hybrid (RRF), with Recall@5, Recall@10 and MRR@10 over expected files.
3. Answer eval through the real answer pipeline for each mode. Scored in code: file recall and MRR over everything retrieved or read, citation validity, and whether unanswerable questions are declined. Judged by the answer model: correctness against key facts, and faithfulness to the cited code. Cost, latency and tokens come from the traces.
4. `pnpm eval` indexes the sample repo at the golden commit if needed, prints the tables and writes `docs/eval-results.md`. Without an Anthropic key the answer part is skipped and says why.
5. CI runs `pnpm eval --retrieval-only --min-recall=<floor>` against a pgvector service with the fake embedder.
