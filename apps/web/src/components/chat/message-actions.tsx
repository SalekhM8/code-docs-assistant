"use client";

import { Activity, ThumbsDown, ThumbsUp } from "lucide-react";
import type { Message, Rating } from "@cda/shared";
import { usePanels } from "@/components/panels";
import { Button } from "@/components/ui/button";
import { useFeedback } from "@/lib/queries";
import { cn } from "@/lib/utils";

/** Thumbs up or down (stored against the answer's trace) and the trace panel. */
export function MessageActions({ message, conversationId }: { message: Message; conversationId: string }) {
  const feedback = useFeedback(conversationId);
  const { openTrace } = usePanels();
  const traceId = message.traceId;
  if (!traceId) return null;

  const rate = (rating: Rating) => feedback.mutate({ traceId, rating: message.feedback === rating ? null : rating });
  return (
    <span className="flex items-center gap-0.5">
      <Button variant="ghost" size="icon-sm" aria-label="Good answer" aria-pressed={message.feedback === "up"} title="Good answer" onClick={() => rate("up")}>
        <ThumbsUp className={cn(message.feedback === "up" && "fill-current text-green-text")} />
      </Button>
      <Button variant="ghost" size="icon-sm" aria-label="Bad answer" aria-pressed={message.feedback === "down"} title="Bad answer" onClick={() => rate("down")}>
        <ThumbsDown className={cn(message.feedback === "down" && "fill-current text-red-text")} />
      </Button>
      <Button variant="ghost" size="sm" onClick={() => openTrace(traceId)}>
        <Activity /> Trace
      </Button>
      {feedback.isError && <span role="alert" className="text-red-text">{feedback.error.message}</span>}
    </span>
  );
}
