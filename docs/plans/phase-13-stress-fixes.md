# Phase 13: Fixes from the real-model stress test

The first run with real Claude and Voyage keys, plus a stress test over 25 repos and about 110 questions, found the issues listed in `docs/stress-test-findings.md`. This phase fixes them. Each fix ships with a test, and each was re-checked against the question that exposed it.

1. **Citations.** One grammar in `packages/shared` for the api checker and the web renderer. Paths may contain spaces and one level of square brackets (Next.js routes). A shortened path is rewritten to the one retrieved file it can mean. A range may end on the empty last line a trailing newline produces.
2. **Follow-ups.** History is built from whole question and answer pairs (six pairs in full, older ones summarised). A stopped or failed answer drops its question too. Valid citations from earlier answers count as evidence, so a follow-up can repeat them.
3. **Declining.** Prompt `answer.v2`: decline what it cannot do (run, write, browse, off-topic) with a reason and an alternative, always cite full paths, and know which commit it reads. A not-found explanation keeps its checked citations. The fallback for an uncited reply says what to ask instead.
4. **Indexing.** A NUL byte anywhere in a file marks it binary. `.prisma` is indexed. An empty repo gets its own message.
5. **Logging.** A custom error serializer removes query parameters (file contents, answer text) from database errors.
6. **Concurrency.** One answer at a time per conversation; a second question gets 409 `conversation_busy`.
7. **Retrieval.** Keyword results are weighted 0.3 in the fusion, from the measured eval.
8. **Eval judge.** Structured output (JSON schema) for the verdict.
9. **Small things.** `http://`, `www.`, scheme-less and SSH repo addresses are normalised. Separate rate-limit windows for asking and adding. Clearer validation messages. Control characters rejected in file paths.

Not done, listed as known gaps in the README: content-based secret detection beyond the existing patterns, a staleness check against GitHub, notebooks, a whole-repo stats tool, temp folders left after a hard kill.
