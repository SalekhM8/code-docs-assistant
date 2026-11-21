import type { AnswerMode } from "@cda/shared";
import type { AnswerResult } from "./answer-eval";
import type { RetrievalRow } from "./retrieval-eval";
import { mean, percentile } from "./scorers";

export interface ReportMeta {
  date: string;
  commit: string;
  questions: number;
  reviewed: boolean;
  embeddingModel: string;
  answerModel: string;
  skippedAnswers: string | null;
}

const pct = (v: number | null) => (v === null ? "n/a" : `${(v * 100).toFixed(1)}%`);
const num = (v: number | null, digits = 3) => (v === null ? "n/a" : v.toFixed(digits));

function table(header: string[], rows: string[][]): string {
  return [`| ${header.join(" | ")} |`, `| ${header.map(() => "---").join(" | ")} |`, ...rows.map((r) => `| ${r.join(" | ")} |`)].join("\n");
}

export function retrievalTable(rows: RetrievalRow[]): string {
  return table(["Search", "Recall@5", "Recall@10", "MRR@10"], rows.map((r) => [r.variant, pct(r.recallAt5), pct(r.recallAt10), num(r.mrr)]));
}

export function answerTable(results: AnswerResult[]): string {
  const modes: AnswerMode[] = [...new Set(results.map((r) => r.mode))];
  return table(
    ["Mode", "File recall", "MRR", "Citation validity", "Correctness (judge)", "Faithfulness (judge)", "Declines unanswerable", "Avg cost", "p50 latency", "p95 latency", "Avg tokens"],
    modes.map((mode) => {
      const rs = results.filter((r) => r.mode === mode);
      const answerable = rs.filter((r) => r.type !== "unanswerable");
      const declines = rs.filter((r) => r.declinedCorrectly !== null);
      const latency = rs.map((r) => r.latencyMs);
      const cost = mean(rs.map((r) => r.costUsd));
      return [
        mode,
        pct(mean(answerable.map((r) => r.recall))),
        num(mean(answerable.map((r) => r.rr))),
        pct(mean(rs.map((r) => r.citationValidity))),
        pct(mean(answerable.map((r) => r.judge?.correctness ?? null))),
        pct(mean(answerable.map((r) => r.judge?.faithfulness ?? null))),
        declines.length ? `${declines.filter((r) => r.declinedCorrectly).length}/${declines.length}` : "n/a",
        cost === null ? "n/a" : `$${cost.toFixed(4)}`,
        `${((percentile(latency, 50) ?? 0) / 1000).toFixed(1)}s`,
        `${((percentile(latency, 95) ?? 0) / 1000).toFixed(1)}s`,
        String(Math.round(mean(rs.map((r) => r.tokens)) ?? 0)),
      ];
    }),
  );
}

export function renderReport(meta: ReportMeta, retrieval: RetrievalRow[], answers: AnswerResult[] | null): string {
  const lines = [
    "# Eval results",
    "",
    `Run ${meta.date} on commander.js \`${meta.commit.slice(0, 12)}\`: ${meta.questions} questions${meta.reviewed ? "" : " (golden set is an unreviewed draft)"}.`,
    `Embeddings: \`${meta.embeddingModel}\`. Answers: \`${meta.answerModel}\`.`,
    "",
    "## Retrieval (scored in code, no model calls)",
    "",
    "Questions with expected files only. Recall@k: share of expected files among the top k chunks. MRR: 1 / rank of the first chunk from an expected file.",
    "",
    retrievalTable(retrieval),
    "",
    "## Answers, baseline vs agent",
    "",
  ];
  if (answers) {
    lines.push(
      "File recall and MRR are over everything the run retrieved or read. Citation validity is the citation checker's pass rate. Correctness is the share of key facts present; faithfulness is the share of claims backed by the cited code (both judged by the answer model). Cost and latency come from the stored traces.",
      "",
      answerTable(answers),
      "",
      "### Per question",
      "",
      table(["Question", "Type", "Mode", "Status", "Recall", "Correct", "Faithful", "Notes"], answers.map((r) => [
        r.id, r.type, r.mode, r.status, pct(r.recall), pct(r.judge?.correctness ?? (r.declinedCorrectly === null ? null : Number(r.declinedCorrectly))), pct(r.judge?.faithfulness ?? null), (r.judge?.notes ?? "").replaceAll("|", "/"),
      ])),
    );
  } else {
    lines.push(`Not run: ${meta.skippedAnswers ?? "skipped"}.`);
  }
  return `${lines.join("\n")}\n`;
}
