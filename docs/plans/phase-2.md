# Phase 2: Indexing (journeys 1, 8, 9 on the API side)

1. `POST /repos`: parse the URL (https github.com only), check GitHub metadata (public, size limit), insert the repo and an `index_jobs` row, and return 202 at once.
2. `IndexRunner` runs jobs in process, two at a time. A restart marks unfinished jobs failed so the UI can offer retry.
3. Pipeline stages, each written to the job row: cloning (shallow, or a single pinned commit) -> scanning (skip rules, file and size limits) -> chunking (tree-sitter, markdown headings, line windows) -> embedding (batched, cache keyed by hash + model) -> activating (one transaction swaps the version and deletes the old one) -> overview (cheap model, with a fallback) -> done.
4. Re-index: if the commit is unchanged, nothing is done. Otherwise files whose hash matches the live version are copied with their chunks and embeddings in SQL, and only changed files are chunked and embedded.
5. `DELETE /repos/:id` cancels a running job and cascades through every table.
6. Tests: unit tests for URL parsing, skip rules, each chunker, batching, Voyage and overview parsing. Integration tests on a fixture repo cover index, skip rules, re-index of changed files only, no-op re-index, the embedding cache, failure then retry, delete, and validation errors.
