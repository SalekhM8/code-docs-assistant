"use client";

import type { ReactNode } from "react";
import { RefreshCw } from "lucide-react";
import type { Message as MessageDto } from "@cda/shared";
import { Button } from "@/components/ui/button";
import { Markdown } from "./markdown";
import { MessageActions } from "./message-actions";

interface Props {
  message: MessageDto;
  conversationId: string;
  repoId: string;
  isLast: boolean;
  onRegenerate: () => void;
  canRegenerate: boolean;
}

export function MessageView({ message, conversationId, repoId, isLast, onRegenerate, canRegenerate }: Props) {
  if (message.role === "user") {
    return (
      <div className="flex justify-end">
        <p className="max-w-[85%] whitespace-pre-wrap bead rounded-[20px] rounded-br-md px-4 py-2.5 text-[15px] font-medium">{message.content}</p>
      </div>
    );
  }
  const regenerate = isLast && canRegenerate && (
    <Button variant="ghost" size="sm" onClick={onRegenerate}>
      <RefreshCw /> Regenerate
    </Button>
  );
  if (message.status === "not_found") {
    return <DeadEnd message={message} repoId={repoId} actions={<><MessageActions message={message} conversationId={conversationId} />{regenerate}</>} />;
  }
  if (message.status === "failed") {
    return (
      <div role="alert" className="space-y-2 rounded-block border-[1.5px] border-red bg-red-tint p-4">
        <p className="text-[14px] font-semibold text-red-text">The answer failed</p>
        <p className="text-[14px] text-text-2">{message.content}</p>
        <div className="flex items-center gap-3 text-[12.5px] text-text-dim">
          <MessageActions message={message} conversationId={conversationId} />
          {regenerate}
        </div>
      </div>
    );
  }
  const invalid = message.citations.filter((c) => !c.valid).length;
  return (
    <article className="space-y-2">
      <p className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-text-dim">As of {new Date(message.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</p>
      <Markdown text={message.content} repoId={repoId} citations={message.citations} />
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[12.5px] text-text-dim">
        {message.status === "stopped" && <span className="rounded-full bg-amber-tint px-2 py-0.5 font-medium text-amber-text">Stopped</span>}
        {message.citations.length > 0 && (
          <span>
            {message.citations.length - invalid} of {message.citations.length} citations verified
            {invalid > 0 && <span className="font-medium text-red-text"> · {invalid} flagged</span>}
          </span>
        )}
        <MessageActions message={message} conversationId={conversationId} />
        {regenerate}
      </div>
    </article>
  );
}

function DeadEnd({ message, repoId, actions }: { message: MessageDto; repoId: string; actions: ReactNode }) {
  return (
    <div className="space-y-3 rounded-block border-[1.5px] border-amber bg-amber-tint p-4">
      <p className="text-[14px] font-semibold text-amber-text">Not found in this repo</p>
      <Markdown text={message.content} repoId={repoId} citations={message.citations} />
      {message.searched.length > 0 && (
        <div>
          <p className="text-[12.5px] font-semibold text-text-2">What I looked at</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-5 text-[13px] text-text-2">
            {message.searched.map((s) => <li key={s} className="break-words">{s}</li>)}
          </ul>
        </div>
      )}
      <div className="flex items-center gap-3 text-[12.5px] text-text-dim">
        {actions}
      </div>
    </div>
  );
}
