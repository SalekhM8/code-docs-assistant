"use client";

import { useState, type KeyboardEvent } from "react";
import { ArrowUp, Square } from "lucide-react";
import type { AnswerMode } from "@cda/shared";
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

const MODES: { value: AnswerMode; label: string; hint: string }[] = [
  { value: "agent", label: "Agent", hint: "Searches and reads files over several steps" },
  { value: "baseline", label: "Quick", hint: "One search, one answer" },
];

/**
 * One glass capsule: the question grows with what you type, and the send bead sits inside it.
 * Enter sends, Shift+Enter adds a line, Escape stops.
 */
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
    <div className="space-y-2.5">
      <div className="glass glass-field flex items-end gap-2 rounded-[26px] p-1.5 pl-[18px]">
        {/* 16px: anything smaller makes iPhones zoom the page when the box is tapped */}
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          aria-label="Question"
          rows={1}
          className="field-sizing-content max-h-40 min-h-10 flex-1 resize-none bg-transparent py-[9px] text-[16px] leading-[1.4] text-text outline-none placeholder:text-text-dim"
        />
        {streaming ? (
          <button type="button" onClick={onStop} className="bead grid size-10 shrink-0 place-items-center rounded-full" title="Stop (Escape)" aria-label="Stop the answer (Escape)">
            <Square className="size-3.5 fill-current" aria-hidden />
          </button>
        ) : (
          <button type="button" onClick={send} disabled={!canSend} className="bead grid size-10 shrink-0 place-items-center rounded-full" title="Send (Enter)" aria-label="Send (Enter)">
            <ArrowUp className="size-[18px]" strokeWidth={2.4} aria-hidden />
          </button>
        )}
      </div>
      <div className="flex items-center justify-between gap-3 px-1">
        <fieldset className="glass relative flex rounded-full p-[3px]" aria-label="Answer mode">
          <span
            aria-hidden
            className="bead absolute inset-y-[3px] left-[3px] w-[calc(50%-3px)] rounded-full transition-transform duration-200 ease-house"
            style={{ transform: mode === "agent" ? "translateX(0)" : "translateX(100%)" }}
          />
          {MODES.map((m) => (
            <label
              key={m.value}
              title={m.hint}
              className={cn(
                "relative z-10 min-w-[68px] cursor-pointer rounded-full px-3 py-1.5 text-center text-[12.5px] font-semibold transition-colors duration-200 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-text",
                mode === m.value ? "text-surface" : "text-text-2 hover:text-text",
              )}
            >
              <input type="radio" name="mode" value={m.value} checked={mode === m.value} onChange={() => onModeChange(m.value)} className="sr-only" />
              {m.label}
            </label>
          ))}
        </fieldset>
        <span className="truncate text-[11.5px] text-text-dim">
          <kbd className="font-sans">Enter</kbd> to ask{streaming ? " · Esc to stop" : " · ⇧Enter new line"}
        </span>
      </div>
    </div>
  );
}
