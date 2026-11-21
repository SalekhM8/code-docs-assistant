# Phase 5: Agent

1. Four read-only tools, scoped to the active index version: `search_code` (hybrid), `find_symbol` (exact, then `Class.name`, then prefix), `read_file` (capped at 200 lines, path normalised so it can only name indexed files) and `list_files`. Inputs are validated with zod and bad calls return error results the model can recover from.
2. The loop is plain code: call the model, run all requested tools in parallel, append the results, repeat. Caps: 6 model steps (the last is forced to answer with `tool_choice: none`), a token cap per answer, and an append-only context budget for tool output.
3. Live steps and orb states come from real tool calls: searching, reading, answering. Narration before tool calls is cleared from the answer with a `reset` event.
4. The citation checker and traces (already built) now cover tool steps; each tool step records the refs it showed.
5. Optional Langfuse export when its keys are set: one trace with a span per step, and no file contents.
6. Tests: tool unit tests (path normalisation, symbol order, read caps, error results) and agent integration tests (multi-tool answer with valid citations, parallel calls, step cap forcing an answer, invalid tool input, trace steps).
