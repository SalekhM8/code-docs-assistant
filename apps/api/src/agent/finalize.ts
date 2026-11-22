import type { Citation, MessageStatus } from "@cda/shared";
import { NOT_FOUND } from "../prompts/answer.v2";
import type { RunContext, RunResult } from "./run-context";
import { checkCitations, expandShortPaths } from "./citations";

export const NO_EVIDENCE_TEXT = "I could not find code in this repository that answers this, so I am not giving an answer.";
/** Shown in place of an uncited reply. It also covers requests that are not about the code, so it says what to ask instead. */
export const UNSUPPORTED_TEXT =
  "I could not back an answer with citations to this repository's code, so I am not showing one. I can only answer questions about this repo's code: try asking where something is defined or how a feature works.";

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
  const text = expandShortPaths(result.text.trim(), ctx.evidence.paths());
  if (text.startsWith(NOT_FOUND)) {
    // The explanation may still point at code ("the closest thing is ..."); those citations are checked like any other.
    const explanation = text.slice(NOT_FOUND.length).trim();
    const cited = explanation ? await checkCitations(ctx.db, ctx.versionId, explanation, ctx.evidence) : [];
    return { status: "not_found", content: explanation || NO_EVIDENCE_TEXT, citations: cited };
  }
  const citations = await checkCitations(ctx.db, ctx.versionId, text, ctx.evidence);
  if (!citations.some((c) => c.valid)) return { status: "not_found", content: UNSUPPORTED_TEXT, citations };
  return { status: "complete", content: text, citations };
}
