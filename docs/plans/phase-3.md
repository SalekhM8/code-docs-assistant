# Phase 3: Baseline answers

1. `retrieval/`: pgvector cosine search (HNSW, iterative scan so the version filter cannot starve results) and Postgres full-text search, run in parallel and merged with reciprocal rank fusion (k = 60).
2. Conversations: create, list, get, delete. Messages are stored with status, citations and what was searched.
3. `POST /conversations/:id/messages` streams Server Sent Events: start, status, step, text, done, error. The client disconnecting aborts the model call and stores the partial answer as `stopped`. `POST /conversations/:id/regenerate` replaces the last answer.
4. Baseline mode: one hybrid search (the question plus the previous question for follow-ups), top 8 chunks with line numbers into one model call. The fixed rules and repo overview are prompt-cached system blocks.
5. Citations `[path:start-end]` are parsed and checked in code: the file exists, the lines are in range, and the range overlaps code retrieved in this run. A `NOT_FOUND:` reply, or an answer with no valid citation, is stored as not found together with the searches made.
6. A trace row and steps are written per answer, and a per-client rate limit applies to answer and add-repo calls.
7. Tests: fusion maths, the citation parser and checker, the query builder, and integration tests that stream a cited answer, hit the not-found path with no model call, stop mid-stream, and regenerate.
