"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { AnswerMode } from "@cda/shared";
import { usePublishActivity } from "@/components/activity";
import { Orb } from "@/components/orb";
import { ChipButton, PanelHeader } from "@/components/panel-header";
import { useAnswerStream } from "@/hooks/use-answer-stream";
import type { Activity } from "@/lib/floor";
import { takePendingQuestion } from "@/lib/pending-question";
import { useConversation, useRepo } from "@/lib/queries";
import { Composer } from "./composer";
import { LiveAnswerView } from "./live-answer";
import { MessageView } from "./message";
import { MessageList } from "./message-list";

export function ChatView({ repoId, conversationId }: { repoId: string; conversationId: string }) {
  const conversation = useConversation(conversationId);
  const repo = useRepo(repoId);
  const stream = useAnswerStream(conversationId);
  const sentPending = useRef(false);
  const [mode, setMode] = useState<AnswerMode>("agent");
  const messages = useMemo(() => conversation.data?.messages ?? [], [conversation.data]);

  // What the 3D floor shows: the live steps while streaming, then the folders the last answer cited.
  const activity = useMemo((): Activity => {
    const lastAnswer = [...messages].reverse().find((m) => m.role === "assistant");
    return { orb: stream.orb, streaming: stream.streaming, steps: stream.live?.steps ?? [], citations: stream.streaming ? [] : (lastAnswer?.citations ?? []) };
  }, [messages, stream.orb, stream.streaming, stream.live?.steps]);
  usePublishActivity(activity, stream.stop);

  // A question asked on the repo page before this conversation existed.
  useEffect(() => {
    if (sentPending.current || !conversation.data) return;
    sentPending.current = true;
    const pending = takePendingQuestion(conversationId);
    if (pending) stream.ask(pending.content, pending.mode);
  }, [conversation.data, conversationId, stream]);

  if (conversation.isPending) return <p className="p-8 text-[14px] text-text-dim">Loading conversation…</p>;
  if (conversation.isError) return <p role="alert" className="p-8 text-[14px] text-red-text">{conversation.error.message}</p>;

  const lastQuestion = [...messages].reverse().find((m) => m.role === "user")?.content ?? "";
  const rows = messages.map((m, i) => ({
    key: m.id,
    node: (
      <MessageView
        message={m}
        conversationId={conversationId}
        repoId={repoId}
        isLast={i === messages.length - 1}
        canRegenerate={!stream.streaming && repo.data?.status === "ready"}
        onRegenerate={() => stream.regenerate(lastQuestion, mode)}
      />
    ),
  }));
  if (stream.live) rows.push({ key: "live", node: <LiveAnswerView live={stream.live} repoId={repoId} onDismiss={stream.dismissError} /> });
  const suggestions = rows.length === 0 ? (repo.data?.suggestedQuestions ?? []).slice(0, 4) : [];

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <PanelHeader eyebrow={repo.data ? `${repo.data.owner}/${repo.data.name}` : "Conversation"} title={conversation.data.title}>
        <Orb state={stream.orb} size={18} className="mt-3" />
      </PanelHeader>
      {rows.length === 0 ? (
        <div className="flex flex-1 items-start px-6 text-[15px] leading-relaxed text-text-2">Ask your first question below. Answers cite the files and lines they come from.</div>
      ) : (
        <MessageList rows={rows} followKey={`${messages.length}:${stream.live?.text.length ?? 0}:${stream.live?.steps.length ?? 0}`} />
      )}
      <div className="border-t-[1.5px] border-line p-4">
        {suggestions.length > 0 && (
          <section className="mb-3 flex flex-wrap gap-1.5" aria-label="Suggested questions">
            {suggestions.map((q) => (
              <ChipButton key={q} onClick={() => stream.ask(q, mode)} disabled={stream.streaming || repo.data?.status !== "ready"}>
                {q}
              </ChipButton>
            ))}
          </section>
        )}
        <Composer mode={mode} onModeChange={setMode} onSend={stream.ask} onStop={stream.stop} streaming={stream.streaming} busy={repo.data?.status !== "ready"} />
      </div>
    </div>
  );
}
