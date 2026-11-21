"use client";

import { useState, type KeyboardEvent } from "react";
import type { AnswerMode } from "@cda/shared";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

interface Props {
  mode: AnswerMode;
  onModeChange: (mode: AnswerMode) => void;
  onSend: (content: string, mode: AnswerMode) => void;
  onStop: () => void;
  streaming: boolean;
  busy?: boolean;
  placeholder?: string;
}

/** The house's ask box: a cream pill and a dark Ask button. Enter sends, Shift+Enter adds a line, Escape stops. */
export function Composer({ mode, onModeChange, onSend, onStop, streaming, busy = false, placeholder = "Ask how something in the code works" }: Props) {
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
    <div>
      <div className="flex items-end gap-2">
        {/* 16px: anything smaller makes iPhones zoom the page when the box is tapped */}
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          aria-label="Question"
          rows={1}
          className="max-h-40 min-h-12 flex-1 resize-none rounded-[24px] border-[1.5px] border-line-strong bg-surface-2 px-4 py-[11px] text-[16px] leading-[1.45] shadow-none focus-visible:border-text focus-visible:ring-2 focus-visible:ring-text"
        />
        {streaming ? (
          <button type="button" onClick={onStop} className="min-h-12 shrink-0 rounded-full bg-text px-5 text-[14px] font-semibold text-surface" title="Stop (Escape)" aria-label="Stop the answer (Escape)">
            Stop
          </button>
        ) : (
          <button type="button" onClick={send} disabled={!canSend} className="min-h-12 shrink-0 rounded-full bg-text px-5 text-[14px] font-semibold text-surface disabled:opacity-45" title="Send (Enter)" aria-label="Send (Enter)">
            Ask
          </button>
        )}
      </div>
      <div className="mt-2.5 flex items-center justify-between gap-2 text-[11.5px] leading-[1.45] text-text-dim">
        <span>Enter sends · Shift+Enter new line{streaming ? " · Escape stops" : ""}</span>
        <fieldset className="flex items-center gap-1" aria-label="Answer mode">
          {(["agent", "baseline"] as const).map((m) => (
            <label key={m} className={cn("cursor-pointer rounded-full px-2.5 py-1 font-semibold", mode === m ? "bg-text text-surface" : "hover:bg-surface-2")}>
              <input type="radio" name="mode" value={m} checked={mode === m} onChange={() => onModeChange(m)} className="sr-only" />
              {m === "agent" ? "Agent" : "Baseline"}
            </label>
          ))}
        </fieldset>
      </div>
    </div>
  );
}
