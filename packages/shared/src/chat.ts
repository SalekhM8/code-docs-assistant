import { z } from "zod";

export const AnswerMode = z.enum(["baseline", "agent"]);
export type AnswerMode = z.infer<typeof AnswerMode>;

export const Citation = z.object({
  path: z.string(),
  startLine: z.number().int(),
  endLine: z.number().int(),
  valid: z.boolean(),
  /** Why the citation checker rejected it, when `valid` is false. */
  reason: z.string().optional(),
});
export type Citation = z.infer<typeof Citation>;

export const MessageStatus = z.enum(["complete", "stopped", "failed", "not_found"]);
export type MessageStatus = z.infer<typeof MessageStatus>;

export const Rating = z.enum(["up", "down"]);
export type Rating = z.infer<typeof Rating>;

export const Message = z.object({
  id: z.string().uuid(),
  role: z.enum(["user", "assistant"]),
  content: z.string(),
  status: MessageStatus,
  citations: z.array(Citation),
  /** Searches and files looked at, shown when nothing was found. */
  searched: z.array(z.string()),
  traceId: z.string().uuid().nullable(),
  feedback: Rating.nullable(),
  createdAt: z.string(),
});
export type Message = z.infer<typeof Message>;

export const ConversationSummary = z.object({
  id: z.string().uuid(),
  repoId: z.string().uuid(),
  title: z.string(),
  updatedAt: z.string(),
});
export type ConversationSummary = z.infer<typeof ConversationSummary>;

export const ConversationDetail = ConversationSummary.extend({ messages: z.array(Message) });
export type ConversationDetail = z.infer<typeof ConversationDetail>;

export const ConversationList = z.array(ConversationSummary);

export const AskRequest = z.object({
  content: z.string().trim().min(1, "Type a question first.").max(4000, "Keep questions under 4000 characters."),
  mode: AnswerMode.optional(),
});
export type AskRequest = z.infer<typeof AskRequest>;

export const RegenerateRequest = z.object({ mode: AnswerMode.optional() });

export const StepKind = z.enum(["search", "symbol", "read", "list"]);
export type StepKind = z.infer<typeof StepKind>;

export const LiveStep = z.object({
  id: z.string(),
  kind: StepKind,
  label: z.string(),
  /** Filled when the step finishes, e.g. "8 results" or "lines 10-80". */
  detail: z.string().optional(),
  done: z.boolean(),
});
export type LiveStep = z.infer<typeof LiveStep>;

/** The orb follows these states, so each one is a real point in the answer pipeline. */
export const AssistantState = z.enum(["searching", "reading", "answering"]);
export type AssistantState = z.infer<typeof AssistantState>;

export const StreamEvent = z.discriminatedUnion("type", [
  z.object({ type: z.literal("start"), userMessage: Message, assistantMessageId: z.string().uuid(), mode: AnswerMode }),
  z.object({ type: z.literal("status"), state: AssistantState }),
  z.object({ type: z.literal("step"), step: LiveStep }),
  z.object({ type: z.literal("text"), delta: z.string() }),
  /** Text streamed so far was narration before tool calls, not the answer: clear it. */
  z.object({ type: z.literal("reset") }),
  z.object({ type: z.literal("done"), message: Message }),
  z.object({ type: z.literal("error"), code: z.string(), message: z.string() }),
]);
export type StreamEvent = z.infer<typeof StreamEvent>;
