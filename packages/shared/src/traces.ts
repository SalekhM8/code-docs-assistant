import { z } from "zod";
import { AnswerMode, Rating } from "./chat";

export const TraceStep = z.object({
  position: z.number().int(),
  kind: z.enum(["model", "tool", "retrieval", "citation_check"]),
  name: z.string(),
  input: z.record(z.string(), z.unknown()),
  output: z.record(z.string(), z.unknown()),
  inputTokens: z.number().int(),
  outputTokens: z.number().int(),
  durationMs: z.number().int(),
  startedAt: z.string(),
});
export type TraceStep = z.infer<typeof TraceStep>;

export const TraceDetail = z.object({
  id: z.string().uuid(),
  messageId: z.string().uuid(),
  mode: AnswerMode,
  model: z.string(),
  promptVersion: z.string(),
  outcome: z.string(),
  inputTokens: z.number().int(),
  outputTokens: z.number().int(),
  cacheReadTokens: z.number().int(),
  cacheWriteTokens: z.number().int(),
  costUsd: z.number().nullable(),
  durationMs: z.number().int(),
  createdAt: z.string(),
  feedback: Rating.nullable(),
  steps: z.array(TraceStep),
});
export type TraceDetail = z.infer<typeof TraceDetail>;

export const FeedbackRequest = z.object({ rating: Rating });
export const FeedbackResponse = z.object({ traceId: z.string().uuid(), rating: Rating.nullable() });
