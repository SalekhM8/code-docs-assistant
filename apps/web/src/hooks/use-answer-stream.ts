"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { AnswerMode, ConversationDetail, Message } from "@cda/shared";
import { type AnswerRequest, api, ApiError } from "@/lib/api";
import { type LiveAnswer, type OrbState, reduceLive, startLive } from "@/lib/live-answer";
import { keys } from "@/lib/queries";
import { streamAnswer } from "@/lib/stream-answer";

/** How long the orb holds "done" or "failed" before returning to idle, as the house does. */
const SETTLE_MS = 2000;

/**
 * Owns one in-flight answer for a conversation: optimistic user message, streaming into
 * `live`, Stop via AbortController, and writing the final messages into the query cache.
 */
export function useAnswerStream(conversationId: string) {
  const qc = useQueryClient();
  const [live, setLive] = useState<LiveAnswer | null>(null);
  const [settled, setSettled] = useState<OrbState>("idle");
  const controller = useRef<AbortController | null>(null);
  const key = useMemo(() => keys.conversation(conversationId), [conversationId]);

  useEffect(() => () => controller.current?.abort(), []);
  useEffect(() => {
    if (settled === "idle") return;
    const t = setTimeout(() => setSettled("idle"), SETTLE_MS);
    return () => clearTimeout(t);
  }, [settled]);

  const patch = useCallback(
    (fn: (messages: Message[]) => Message[]) => qc.setQueryData<ConversationDetail>(key, (c) => (c ? { ...c, messages: fn(c.messages) } : c)),
    [qc, key],
  );

  /** Puts what the stream produced into the cache straight away, before the refetch confirms it. */
  const commit = useCallback((l: LiveAnswer, stopped: boolean) => {
    const assistant: Message | null = l.final ?? (stopped && l.text
      ? { id: `stopped-${Date.now()}`, role: "assistant", content: l.text, status: "stopped", citations: [], searched: [], traceId: null, feedback: null, createdAt: new Date().toISOString() }
      : null);
    patch((messages) => {
      const withoutTemp = messages.filter((m) => !m.id.startsWith("temp-"));
      const user = l.userMessage && !withoutTemp.some((m) => m.id === l.userMessage?.id) ? [l.userMessage] : [];
      return [...withoutTemp, ...user, ...(assistant ? [assistant] : [])];
    });
  }, [patch]);

  /**
   * Replaces the optimistic messages with the server's. After a Stop the server saves the
   * partial answer only once it notices the closed connection, so a refetch can arrive first;
   * retry briefly until the stored answer is there rather than dropping the stopped text.
   */
  const syncFromServer = useCallback(
    async (stopped: boolean) => {
      for (let attempt = 0; attempt < (stopped ? 6 : 1); attempt++) {
        if (attempt > 0) await new Promise((r) => setTimeout(r, 300));
        const fresh = await api.conversation(conversationId).catch(() => null);
        // Until the stopped answer is stored, keep showing the optimistic copy.
        if (fresh && (!stopped || fresh.messages.at(-1)?.role === "assistant")) {
          qc.setQueryData(key, fresh);
          return;
        }
      }
    },
    [qc, key, conversationId],
  );

  const run = useCallback(
    async (req: AnswerRequest, question: string, mode: AnswerMode) => {
      controller.current?.abort();
      const ac = new AbortController();
      controller.current = ac;
      let current = startLive(question, mode);
      setLive(current);
      try {
        await streamAnswer(req, (event) => {
          current = reduceLive(current, event);
          setLive(current);
        }, ac.signal);
        setSettled(current.orb === "failed" || current.error ? "failed" : "done");
      } catch (err) {
        if (ac.signal.aborted) {
          setSettled("idle");
        } else {
          current = { ...current, orb: "failed", error: err instanceof ApiError ? err.message : "The answer stream broke off. Try again." };
          setSettled("failed");
        }
      } finally {
        if (controller.current === ac) controller.current = null;
        commit(current, ac.signal.aborted);
        setLive(current.error ? current : null);
        await syncFromServer(ac.signal.aborted);
        await qc.invalidateQueries({ queryKey: ["conversations"] });
      }
    },
    [qc, commit, syncFromServer],
  );

  const ask = useCallback(
    (content: string, mode: AnswerMode) => {
      // Optimistic: the question appears at once, before the server has stored it.
      const temp: Message = { id: `temp-${Date.now()}`, role: "user", content, status: "complete", citations: [], searched: [], traceId: null, feedback: null, createdAt: new Date().toISOString() };
      patch((m) => [...m, temp]);
      void run({ kind: "ask", conversationId, content, mode }, content, mode);
    },
    [conversationId, patch, run],
  );

  const regenerate = useCallback(
    (question: string, mode: AnswerMode) => {
      patch((m) => (m.at(-1)?.role === "assistant" ? m.slice(0, -1) : m));
      void run({ kind: "regenerate", conversationId, mode }, question, mode);
    },
    [conversationId, patch, run],
  );

  const stop = useCallback(() => controller.current?.abort(), []);
  const dismissError = useCallback(() => setLive(null), []);

  const streaming = live !== null && !live.final && !live.error;
  return { live, streaming, orb: streaming ? live.orb : live?.error ? "failed" : settled, ask, regenerate, stop, dismissError };
}
