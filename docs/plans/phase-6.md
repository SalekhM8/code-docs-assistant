# Phase 6: Chat UI (journeys 2, 4, 5, 7, 10)

1. Design tokens: `docs/design-tokens.md` and one theme file, `apps/web/src/app/theme.css`, taken from the White House source (warm cream palette, Fraunces and Inter, 22px cards, a 1.5px line, house easing and durations). The orb is CSS: a radial gradient plus a glow sized by an animated intensity, using the house's intensity curves.
2. API additions: the file list and file content for the code viewer.
3. Shell: repos and conversations on the left, chat in the centre, code viewer on the right (a full-screen sheet on narrow screens), and a trace drawer slot (filled in phase 7).
4. Journeys:
   - Add a repo, with indexing progress driven by job polling.
   - Repo overview and suggested questions.
   - Streaming answers with the orb and live steps.
   - Citations that open the code viewer with the lines highlighted.
   - Follow-ups, and persisted conversations.
   - Stop (Escape or the button aborts the fetch) and regenerate.
   - Delete a repo or a conversation.
5. Techniques: streaming; optimistic send, delete and feedback; a debounced file filter; lazy code viewer and highlighter; a virtualised file tree and message list; Stop cancelling the request. Everything refetches after each mutation.
6. Unit tests for the SSE parser, the citation linkifier and the stream reducer. The browser test comes in phase 8.
