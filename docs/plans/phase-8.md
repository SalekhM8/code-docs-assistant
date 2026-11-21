# Phase 8: Hardening

1. Limits audit against section 6: repo size, file count, file size, skip rules, 6 steps, a token cap, rate limit, no answer cache. Added: a 64 KB request body limit and a clone timeout check.
2. Error and empty states, journey by journey:
   - Add repo: bad URL, private, too large, GitHub rate limit, clone failure with retry.
   - Ask: not ready, rate limited, provider error, stream broken.
   - Citations: missing file, flagged citation.
   - Re-index: busy, or failed while the old index is kept.
   - Delete, feedback and trace: rollback on error, and a not-found state.
   Added: an api-unreachable banner, an app error boundary and a not-found page.
3. The fake model gets an optional per-word delay (`FAKE_STREAM_DELAY_MS`) so key-less runs and the browser test can watch streaming and press Stop.
4. Playwright: one browser test of the main journey on the seeded sample repo (oriented, ask, stream, open a citation, follow-up, stop, feedback, trace, delete a conversation), plus an add-repo error. It runs against its own database and ports, and in CI.
