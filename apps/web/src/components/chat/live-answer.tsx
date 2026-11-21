"use client";

import { X } from "lucide-react";
import { Orb } from "@/components/orb";
import { Button } from "@/components/ui/button";
import type { LiveAnswer } from "@/lib/live-answer";
import { LiveSteps } from "./live-steps";
import { Markdown } from "./markdown";

/** The answer while it streams: orb and live steps on top, text below as it arrives. */
export function LiveAnswerView({ live, repoId, onDismiss }: { live: LiveAnswer; repoId: string; onDismiss: () => void }) {
  if (live.error) {
    return (
      <div role="alert" className="flex items-start gap-3 rounded-block border-[1.5px] border-red bg-red-tint p-4">
        <Orb state="failed" label={false} />
        <div className="flex-1 space-y-1">
          <p className="text-[14px] font-semibold text-red-text">The answer could not be completed</p>
          <p className="text-[14px] text-text-2">{live.error}</p>
        </div>
        <Button variant="ghost" size="icon-sm" onClick={onDismiss} aria-label="Dismiss">
          <X />
        </Button>
      </div>
    );
  }
  return (
    <div className="space-y-3" aria-busy="true">
      <div className="space-y-2 rounded-block border-[1.5px] border-line bg-surface p-3">
        <div className="flex items-center justify-between">
          <Orb state={live.orb} />
          <span className="text-[11.5px] font-medium uppercase tracking-[0.16em] text-text-dim">{live.mode}</span>
        </div>
        <LiveSteps steps={live.steps} />
      </div>
      {live.text && <Markdown text={live.text} repoId={repoId} citations={null} />}
    </div>
  );
}
