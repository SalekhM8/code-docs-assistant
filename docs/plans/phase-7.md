# Phase 7: Trace and feedback (journeys 11, 12)

1. API: `GET /traces/:id` returns the trace (mode, model, prompt version, outcome, tokens including cache, cost, duration) and its ordered steps. `PUT /traces/:id/feedback` stores a thumbs up or down (one per trace, updatable) and `DELETE` clears it.
2. Web: thumbs up and down on every answer, optimistic and rolled back on error. A Trace button opens a drawer showing totals, the searches made, files opened, and each step with its timing and tokens. Refs in the drawer open the code viewer.
3. Tests: the trace endpoint returns real recorded steps for an answer, feedback upserts and clears, and a feedback request for an unknown trace gets a 404.
