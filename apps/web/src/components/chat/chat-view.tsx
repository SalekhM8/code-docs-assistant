"use client";

import { useEffect, useRef, useState } from "react";
import type { AnswerMode } from "@cda/shared";
import { Orb } from "@/components/orb";
import { useAnswerStream } from "@/hooks/use-answer-stream";
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

  // A question asked on the repo page before this conversation existed.
  useEffect(() => {
    if (sentPending.current || !conversation.data) return;
    sentPending.current = true;
    const pending = takePendingQuestion(conversationId);
    if (pending) stream.ask(pending.content, pending.mode);
  }, [conversation.data, conversationId, stream]);

  if (conversation.isPending) return <p className="p-8 text-[14px] text-text-dim">Loading conversation…</p>;
  if (conversation.isError) return <p role="alert" className="p-8 text-[14px] text-red-text">{conversation.error.message}</p>;

  const messages = conversation.data.messages;
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

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="flex items-center justify-between gap-4 border-b-[1.5px] border-line bg-surface px-6 py-3">
        <div className="min-w-0">
          <h1 className="truncate text-[15px] font-semibold">{conversation.data.title}</h1>
          <p className="truncate text-[12.5px] text-text-dim">{repo.data ? `${repo.data.owner}/${repo.data.name}` : ""}</p>
        </div>
        <Orb state={stream.orb} size={22} />
      </header>
      {rows.length === 0 ? (
        <div className="flex flex-1 items-center justify-center p-8 text-center text-[14px] text-text-dim">Ask your first question below.</div>
      ) : (
        <MessageList rows={rows} followKey={`${messages.length}:${stream.live?.text.length ?? 0}:${stream.live?.steps.length ?? 0}`} />
      )}
      <div className="border-t-[1.5px] border-line bg-surface px-4 py-3">
        <div className="mx-auto max-w-3xl">
          <Composer mode={mode} onModeChange={setMode} onSend={stream.ask} onStop={stream.stop} streaming={stream.streaming} busy={repo.data?.status !== "ready"} />
        </div>
      </div>
    </div>
  );
}
