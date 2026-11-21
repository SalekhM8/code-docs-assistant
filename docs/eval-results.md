# Eval results

Run 2026-11-21 on commander.js `a5a7dc084d4d`: 34 questions (golden set is an unreviewed draft).
Embeddings: `fake-hash-embeddings`. Answers: `fake-answer`.

## Retrieval (scored in code, no model calls)

Questions with expected files only. Recall@k: share of expected files among the top k chunks. MRR: 1 / rank of the first chunk from an expected file.

| Search | Recall@5 | Recall@10 | MRR@10 |
| --- | --- | --- | --- |
| vector | 37.2% | 60.6% | 0.282 |
| keyword | 32.8% | 44.4% | 0.197 |
| hybrid | 51.1% | 66.1% | 0.344 |

## Answers, baseline vs agent

Not run: no ANTHROPIC_API_KEY (LLM_PROVIDER=fake); answer quality needs a real model.
