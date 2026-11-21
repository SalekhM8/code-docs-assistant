# AI log

One line per entry. `ASSUMED`: a choice the brief did not cover. `CHANGED`: done differently from the brief, and why. `BLOCKED`: could not be done.

- BLOCKED: no `.env`, so no `ANTHROPIC_API_KEY` or `VOYAGE_API_KEY`. Everything is built and tested with the fake providers; real eval runs are skipped until keys are added.
- ASSUMED: `WHITE_HOUSE_REPO` is not set, but the author's White House app was found locally (`~/Ventures/palmer-clone`: house UI in `src/components/house3d`, design brief in `white-house/BRIEF.md`). Design tokens are read from that source. Its marketing pages copy a third-party site, so nothing is taken from them.
- ASSUMED: model ids checked on 2026-11-21. Answers `claude-sonnet-5-5`, cheap steps `claude-haiku-5-5`, embeddings `voyage-code-4` (1024 dims).
- ASSUMED: sample repo is `tj/commander.js` (MIT, ~220 files, well known) pinned to v15.1.0, commit `a5a7dc084d4d2b7932e85ca049c5204e50a2c721`. Its large `Command` class exercises split-by-method chunking.
- ASSUMED: TypeScript 5.9, not 7.0. 7.0 (the Go port) shipped days ago and typescript-eslint, Next and drizzle-kit are not confirmed on it.
