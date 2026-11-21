"use client";

import { useState, type KeyboardEvent } from "react";
import { ArrowUp, Square } from "lucide-react";
import type { AnswerMode } from "@cda/shared";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

interface Props {
  mode: AnswerMode;
  onModeChange: (mode: AnswerMode) => void;
  onSend: (content: string, mode: AnswerMode) => void;
  onStop: () => void;
  streaming: boolean;
  busy?: boolean;
  placeholder?: string;
}

/** Enter sends, Shift+Enter adds a line, Escape stops. Typing stays possible while an answer streams. */
export function Composer({ mode, onModeChange, onSend, onStop, streaming, busy = false, placeholder = "Ask a question about the code…" }: Props) {
  const [text, setText] = useState("");
  const canSend = text.trim().length > 0 && !streaming && !busy;

  const send = () => {
    if (!canSend) return;
    onSend(text.trim(), mode);
    setText("");
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      send();
    } else if (e.key === "Escape" && streaming) {
      e.preventDefault();
      onStop();
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-end gap-2 rounded-[24px] border-[1.5px] border-line-strong bg-surface-2 p-1.5 pl-4 focus-within:border-text">
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          aria-label="Question"
          rows={1}
          className="max-h-48 min-h-10 flex-1 resize-none border-0 bg-transparent px-0 py-2 text-[16px] shadow-none focus-visible:ring-0"
        />
        {streaming ? (
          <Button size="icon" className="size-10" onClick={onStop} aria-label="Stop the answer (Escape)" title="Stop (Escape)">
            <Square className="fill-current" />
          </Button>
        ) : (
          <Button size="icon" className="size-10" onClick={send} disabled={!canSend} aria-label="Send (Enter)" title="Send (Enter)">
            <ArrowUp />
          </Button>
        )}
      </div>
      <div className="flex items-center justify-between px-2 text-[12px] text-text-dim">
        <span className="hidden sm:inline">Enter to send · Shift+Enter for a new line{streaming ? " · Escape to stop" : ""}</span>
        <span className="sm:hidden" />
        <fieldset className="flex items-center gap-1" aria-label="Answer mode">
          {(["agent", "baseline"] as const).map((m) => (
            <label key={m} className={`cursor-pointer rounded-full px-2.5 py-1 ${mode === m ? "bg-text text-surface" : "hover:bg-surface-2"}`}>
              <input type="radio" name="mode" value={m} checked={mode === m} onChange={() => onModeChange(m)} className="sr-only" />
              {m === "agent" ? "Agent" : "Baseline"}
            </label>
          ))}
        </fieldset>
      </div>
    </div>
  );
}
