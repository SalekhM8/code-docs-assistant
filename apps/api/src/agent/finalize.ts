import type { Citation, MessageStatus } from "@cda/shared";
import { NOT_FOUND } from "../prompts/answer.v1";
import type { RunContext, RunResult } from "./run-context";
import { checkCitations } from "./citations";

export const NO_EVIDENCE_TEXT = "I could not find code in this repository that answers this, so I am not giving an answer.";
export const UNSUPPORTED_TEXT = "I could not back an answer with valid citations to this repository's code, so none is shown.";

export interface FinalAnswer {
  status: MessageStatus;
  content: string;
  citations: Citation[];
}

/**
 * Applies "no evidence means no answer" in code: a NOT_FOUND reply, an empty retrieval, or
 * an answer without a single valid citation is stored as not found, never as an answer.
 */
export async function finalizeAnswer(ctx: RunContext, result: RunResult): Promise<FinalAnswer> {
  if (result.stopReason === "refusal") {
    return { status: "failed", content: "The model declined to answer this question. Try rephrasing it.", citations: [] };
  }
  if (result.stopReason === "no_evidence") return { status: "not_found", content: NO_EVIDENCE_TEXT, citations: [] };
  const text = result.text.trim();
  if (text.startsWith(NOT_FOUND)) {
    return { status: "not_found", content: text.slice(NOT_FOUND.length).trim() || NO_EVIDENCE_TEXT, citations: [] };
  }
  const citations = await checkCitations(ctx.db, ctx.versionId, text, ctx.evidence);
  if (!citations.some((c) => c.valid)) return { status: "not_found", content: UNSUPPORTED_TEXT, citations };
  return { status: "complete", content: text, citations };
}
