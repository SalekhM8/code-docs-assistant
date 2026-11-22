import { asc, desc, eq } from "drizzle-orm";
import type { ConversationDetail, ConversationSummary, Message } from "@cda/shared";
import type { Db } from "../db/client";
import { conversations, feedback, messages, repos, traces, type StoredCitation } from "../db/schema";
import type { LineRange } from "../agent/evidence";
import { RECENT_TURNS, type HistoryTurn } from "../agent/context";
import { AppError, notFound } from "../lib/errors";
import type { Logger } from "../lib/logger";
import type { LlmProvider } from "../providers/llm";
import { SUMMARY_SYSTEM, TITLE_SYSTEM } from "../prompts/conversation.v1";

export const DEFAULT_TITLE = "New conversation";

type ConversationRow = typeof conversations.$inferSelect;

export interface NewAssistantMessage {
  id: string;
  content: string;
  status: Message["status"];
  citations: StoredCitation[];
  searched: string[];
}

export class ConversationService {
  constructor(private readonly deps: { db: Db; llm: LlmProvider; log: Logger }) {}

  async list(repoId: string): Promise<ConversationSummary[]> {
    const rows = await this.deps.db.select().from(conversations).where(eq(conversations.repoId, repoId)).orderBy(desc(conversations.updatedAt));
    return rows.map(toSummary);
  }

  async create(repoId: string): Promise<ConversationSummary> {
    const [repo] = await this.deps.db.select({ id: repos.id }).from(repos).where(eq(repos.id, repoId));
    if (!repo) throw notFound("That repo");
    const [row] = await this.deps.db.insert(conversations).values({ repoId, title: DEFAULT_TITLE }).returning();
    if (!row) throw new Error("insert into conversations returned no row");
    return toSummary(row);
  }

  async require(id: string): Promise<ConversationRow> {
    const [row] = await this.deps.db.select().from(conversations).where(eq(conversations.id, id));
    if (!row) throw notFound("That conversation");
    return row;
  }

  async get(id: string): Promise<ConversationDetail> {
    const row = await this.require(id);
    return { ...toSummary(row), messages: await this.messages(id) };
  }

  async delete(id: string): Promise<void> {
    const deleted = await this.deps.db.delete(conversations).where(eq(conversations.id, id)).returning({ id: conversations.id });
    if (deleted.length === 0) throw notFound("That conversation");
  }

  async messages(conversationId: string): Promise<Message[]> {
    const rows = await this.deps.db
      .select({ m: messages, traceId: traces.id, rating: feedback.rating })
      .from(messages)
      .leftJoin(traces, eq(traces.messageId, messages.id))
      .leftJoin(feedback, eq(feedback.traceId, traces.id))
      .where(eq(messages.conversationId, conversationId))
      .orderBy(asc(messages.createdAt));
    return rows.map((r) => toMessage(r.m, r.traceId, r.rating));
  }

  async addUserMessage(conversationId: string, content: string): Promise<Message> {
    const [row] = await this.deps.db.insert(messages).values({ conversationId, role: "user", content }).returning();
    if (!row) throw new Error("insert into messages returned no row");
    await this.touch(conversationId);
    return toMessage(row, null, null);
  }

  async saveAssistant(conversationId: string, m: NewAssistantMessage): Promise<void> {
    await this.deps.db.insert(messages).values({ conversationId, role: "assistant", ...m });
    await this.touch(conversationId);
  }

  /** For regenerate: drops the last answer and returns the question it answered. */
  async popLastAnswer(conversationId: string): Promise<Message> {
    const all = await this.messages(conversationId);
    const last = all.at(-1);
    if (last?.role === "assistant") await this.deps.db.delete(messages).where(eq(messages.id, last.id));
    const question = [...all].reverse().find((m) => m.role === "user");
    if (!question) throw new AppError("invalid_request", "There is no question to regenerate an answer for.");
    return question;
  }

  /** Earlier turns for the model, excluding the question being answered now. */
  async history(conversationId: string, beforeMessageId: string): Promise<{ turns: HistoryTurn[]; summary: string | null; priorCitations: LineRange[] }> {
    const conversation = await this.require(conversationId);
    const all = await this.messages(conversationId);
    const cut = all.findIndex((m) => m.id === beforeMessageId);
    const answered = answeredTurns(cut >= 0 ? all.slice(0, cut) : all);
    const priorCitations = answered.slice(-RECENT_TURNS).flatMap((m) => m.citations.filter((c) => c.valid));
    return { turns: answered.map((m) => ({ role: m.role, content: m.content })), summary: conversation.summary, priorCitations };
  }

  /**
   * Runs after an answer, never before one, so it cannot delay the first streamed words.
   * Sets a title after the first exchange and folds turns that left the recent window into the summary.
   */
  async afterAnswer(conversationId: string, question: string): Promise<void> {
    try {
      const conversation = await this.require(conversationId);
      if (conversation.title === DEFAULT_TITLE) await this.setTitle(conversationId, question);
      await this.updateSummary(conversation);
    } catch (err) {
      this.deps.log.warn({ err, conversationId }, "post-answer housekeeping failed");
    }
  }

  private async setTitle(conversationId: string, question: string): Promise<void> {
    const result = await this.deps.llm.complete({ tier: "cheap", system: TITLE_SYSTEM, prompt: question, maxTokens: 60 });
    const title = result.text.replace(/["\n]/g, " ").trim().slice(0, 80) || question.slice(0, 60);
    await this.deps.db.update(conversations).set({ title }).where(eq(conversations.id, conversationId));
  }

  private async updateSummary(conversation: ConversationRow): Promise<void> {
    const all = answeredTurns(await this.messages(conversation.id));
    const foldUpTo = all.length - RECENT_TURNS;
    if (foldUpTo <= conversation.summaryUpTo) return;
    const fresh = all.slice(conversation.summaryUpTo, foldUpTo).map((m) => `${m.role}: ${m.content}`).join("\n\n");
    const prompt = `${conversation.summary ? `Existing summary:\n${conversation.summary}\n\n` : ""}New turns:\n${fresh}`;
    const result = await this.deps.llm.complete({ tier: "cheap", system: SUMMARY_SYSTEM, prompt, maxTokens: 600 });
    await this.deps.db.update(conversations).set({ summary: result.text, summaryUpTo: foldUpTo }).where(eq(conversations.id, conversation.id));
  }

  private async touch(conversationId: string): Promise<void> {
    await this.deps.db.update(conversations).set({ updatedAt: new Date() }).where(eq(conversations.id, conversationId));
  }
}

/**
 * The question and answer pairs the model should see as history: answered or declined ones.
 * A stopped or failed answer drops its question too, so roles always alternate and a later
 * turn is never asked to answer an old question again.
 */
export function answeredTurns(all: Message[]): Message[] {
  const out: Message[] = [];
  for (let i = 0; i + 1 < all.length; i++) {
    const question = all[i];
    const answer = all[i + 1];
    if (question?.role !== "user" || answer?.role !== "assistant") continue;
    if (answer.status === "complete" || answer.status === "not_found") out.push(question, answer);
    i++;
  }
  return out;
}

function toSummary(row: ConversationRow): ConversationSummary {
  return { id: row.id, repoId: row.repoId, title: row.title, updatedAt: row.updatedAt.toISOString() };
}

function toMessage(m: typeof messages.$inferSelect, traceId: string | null, rating: "up" | "down" | null): Message {
  return {
    id: m.id,
    role: m.role,
    content: m.content,
    status: m.status,
    citations: m.citations,
    searched: m.searched,
    traceId,
    feedback: rating,
    createdAt: m.createdAt.toISOString(),
  };
}
