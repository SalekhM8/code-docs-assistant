import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import type { Citation } from "@cda/shared";
import type { Db } from "../db/client";
import { files } from "../db/schema";
import type { LlmProvider } from "../providers/llm";
import { JUDGE_SYSTEM } from "../prompts/judge.v1";
import { wrapData } from "../prompts/untrusted";
import type { GoldenQuestion } from "./golden";

const Verdict = z.object({
  facts: z.array(z.object({ fact: z.string(), present: z.boolean() })),
  faithfulness: z.number().transform((n) => Math.min(1, Math.max(0, n))),
  notes: z.string(),
});

/**
 * The same shape as `Verdict`, sent as a structured-output schema. Free-form JSON from the
 * judge was unreadable in 7 of 60 verdicts on the first real run (stray quotes, prose).
 */
const VERDICT_SCHEMA = {
  type: "object",
  properties: {
    facts: {
      type: "array",
      items: { type: "object", properties: { fact: { type: "string" }, present: { type: "boolean" } }, required: ["fact", "present"], additionalProperties: false },
    },
    faithfulness: { type: "number" },
    notes: { type: "string" },
  },
  required: ["facts", "faithfulness", "notes"],
  additionalProperties: false,
};

export interface JudgeScore {
  correctness: number;
  faithfulness: number;
  notes: string;
}

/** Model-graded correctness (key facts present) and faithfulness (claims backed by cited code). */
export async function judgeAnswer(llm: LlmProvider, db: Db, versionId: string, q: GoldenQuestion, answer: string, citations: Citation[]): Promise<JudgeScore | null> {
  const prompt = [
    `Question: ${q.question}`,
    `Key facts:\n${q.keyFacts.map((f, i) => `${i + 1}. ${f}`).join("\n")}`,
    wrapData("answer being graded", answer),
    await citedCode(db, versionId, citations),
  ].join("\n\n");
  const result = await llm.complete({ tier: "answer", system: JUDGE_SYSTEM, prompt, maxTokens: 4000, jsonSchema: VERDICT_SCHEMA });
  const start = result.text.indexOf("{");
  const parsed = Verdict.safeParse(safeJson(result.text.slice(start, result.text.lastIndexOf("}") + 1)));
  if (!parsed.success) {
    // Eval-only CLI output: says why a score is missing instead of leaving a silent "-". The reply is model output, not repo content.
    console.error(`  judge: unreadable verdict for ${q.id} (${parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}): ${result.text.slice(-400).replace(/\s+/g, " ")}`);
    return null;
  }
  const present = parsed.data.facts.filter((f) => f.present).length;
  return { correctness: present / q.keyFacts.length, faithfulness: parsed.data.faithfulness, notes: parsed.data.notes };
}

async function citedCode(db: Db, versionId: string, citations: Citation[]): Promise<string> {
  const valid = citations.filter((c) => c.valid);
  if (valid.length === 0) return "Cited code: none.";
  const rows = await db.select({ path: files.path, content: files.content }).from(files)
    .where(and(eq(files.versionId, versionId), inArray(files.path, [...new Set(valid.map((c) => c.path))])));
  const byPath = new Map(rows.map((r) => [r.path, r.content.split("\n")]));
  return valid
    .map((c) => wrapData(`${c.path}:${c.startLine}-${c.endLine}`, (byPath.get(c.path) ?? []).slice(c.startLine - 1, c.endLine).join("\n")))
    .join("\n\n");
}

function safeJson(text: string): unknown {
  try {
    return trimKeys(JSON.parse(text));
  } catch {
    return undefined;
  }
}

/** The judge model occasionally emits keys like " faithfulness"; trimming them keeps an otherwise valid verdict. */
export function trimKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(trimKeys);
  if (value === null || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value).map(([k, v]) => [k.trim(), trimKeys(v)]));
}
