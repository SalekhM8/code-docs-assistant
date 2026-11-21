import { randomUUID } from "node:crypto";
import type { AnswerMode, Message, StreamEvent } from "@cda/shared";
import { historyMessages } from "../agent/context";
import { Evidence } from "../agent/evidence";
import { finalizeAnswer, type FinalAnswer } from "../agent/finalize";
import type { RunContext, RunResult } from "../agent/run-context";
import type { Db } from "../db/client";
import { AppError } from "../lib/errors";
import type { Logger } from "../lib/logger";
import type { LlmProvider } from "../providers/llm";
import { AGENT_SYSTEM, ANSWER_PROMPT_VERSION, BASELINE_SYSTEM, overviewBlock } from "../prompts/answer.v1";
import type { HybridSearch } from "../retrieval/hybrid";
import type { ConversationService } from "./conversations";
import type { RepoService } from "./repos";
import { TraceRecorder } from "./trace";

export type Emit = (event: StreamEvent) => void;
export type ModeRunner = (ctx: RunContext) => Promise<RunResult>;

interface AnswerDeps {
  db: Db;
  llm: LlmProvider;
  search: HybridSearch;
  repos: RepoService;
  conversations: ConversationService;
  log: Logger;
  modes: Record<AnswerMode, ModeRunner>;
  defaultMode: AnswerMode;
  limits: RunContext["limits"];
  /** Called with each saved trace, e.g. to export it to Langfuse. */
  onTrace?: (traceId: string) => void;
}

export class AnswerService {
  constructor(private readonly deps: AnswerDeps) {}

  /** Checked before a stream opens, so these failures reach the client as plain JSON errors. */
  async ensureReady(conversationId: string): Promise<void> {
    const conversation = await this.deps.conversations.require(conversationId);
    await this.deps.repos.requireReady(conversation.repoId);
  }

  async ask(conversationId: string, content: string, mode: AnswerMode | undefined, emit: Emit, signal: AbortSignal): Promise<void> {
    const conversation = await this.deps.conversations.require(conversationId);
    const ready = await this.deps.repos.requireReady(conversation.repoId);
    const userMessage = await this.deps.conversations.addUserMessage(conversationId, content);
    await this.run(conversationId, ready, userMessage, mode ?? this.deps.defaultMode, emit, signal);
  }

  async regenerate(conversationId: string, mode: AnswerMode | undefined, emit: Emit, signal: AbortSignal): Promise<void> {
    const conversation = await this.deps.conversations.require(conversationId);
    const ready = await this.deps.repos.requireReady(conversation.repoId);
    const question = await this.deps.conversations.popLastAnswer(conversationId);
    await this.run(conversationId, ready, question, mode ?? this.deps.defaultMode, emit, signal);
  }

  private async run(
    conversationId: string,
    ready: Awaited<ReturnType<RepoService["requireReady"]>>,
    question: Message,
    mode: AnswerMode,
    emit: Emit,
    signal: AbortSignal,
  ): Promise<void> {
    const assistantMessageId = randomUUID();
    const log = this.deps.log.child({ conversationId, assistantMessageId, mode });
    emit({ type: "start", userMessage: question, assistantMessageId, mode });

    const { turns, summary } = await this.deps.conversations.history(conversationId, question.id);
    let streamed = "";
    const ctx = this.context(ready, question.content, mode, historyMessages(turns, summary), emit, signal, {
      onText: (delta) => {
        streamed += delta;
        emit({ type: "text", delta });
      },
      onReset: () => {
        streamed = "";
        emit({ type: "reset" });
      },
    });

    const final = await this.execute(ctx, mode, () => streamed, log);
    const traceId = await this.persist(conversationId, assistantMessageId, final, ctx, mode);
    log.info({ status: final.status, traceId, ...ctx.trace.totals().usage }, "answer finished");
    this.deps.onTrace?.(traceId);
    emit({
      type: "done",
      message: {
        id: assistantMessageId, role: "assistant", content: final.content, status: final.status, citations: final.citations,
        searched: ctx.evidence.searched, traceId, feedback: null, createdAt: new Date().toISOString(),
      },
    });
    if (final.status !== "stopped") void this.deps.conversations.afterAnswer(conversationId, question.content);
  }

  /** Runs the mode and turns every way it can end (answer, stop, error) into a message to store. */
  private async execute(ctx: RunContext, mode: AnswerMode, streamed: () => string, log: Logger): Promise<FinalAnswer> {
    try {
      const result = await this.deps.modes[mode](ctx);
      const final = await finalizeAnswer(ctx, result);
      ctx.trace.note("citation_check", "citations", { status: final.status, cited: final.citations.length, valid: final.citations.filter((c) => c.valid).length });
      return final;
    } catch (err) {
      if (ctx.signal.aborted) return { status: "stopped", content: streamed(), citations: [] };
      log.error({ err }, "answer failed");
      const message = err instanceof AppError ? err.message : "Something went wrong while answering. Try again.";
      return { status: "failed", content: message, citations: [] };
    }
  }

  private context(
    ready: Awaited<ReturnType<RepoService["requireReady"]>>,
    question: string,
    mode: AnswerMode,
    history: RunContext["history"],
    emit: Emit,
    signal: AbortSignal,
    text: Pick<RunContext, "onText" | "onReset">,
  ): RunContext {
    const repoName = `${ready.repo.owner}/${ready.repo.name}`;
    return {
      db: this.deps.db,
      llm: this.deps.llm,
      search: this.deps.search,
      versionId: ready.versionId,
      question,
      history,
      // Fixed rules first and cached; the overview is stable per repo, so it is cached too.
      system: [
        { text: mode === "agent" ? AGENT_SYSTEM : BASELINE_SYSTEM, cache: true },
        { text: overviewBlock(repoName, ready.repo.overview), cache: true },
      ],
      evidence: new Evidence(),
      trace: new TraceRecorder(),
      signal,
      limits: this.deps.limits,
      onState: (state) => emit({ type: "status", state }),
      onStep: (step) => emit({ type: "step", step }),
      ...text,
    };
  }

  private async persist(conversationId: string, id: string, final: FinalAnswer, ctx: RunContext, mode: AnswerMode): Promise<string> {
    await this.deps.conversations.saveAssistant(conversationId, { id, ...final, searched: ctx.evidence.searched });
    return ctx.trace.save(this.deps.db, {
      messageId: id,
      conversationId,
      mode,
      model: this.deps.llm.modelFor("answer"),
      promptVersion: ANSWER_PROMPT_VERSION,
      outcome: final.status,
    });
  }
}
