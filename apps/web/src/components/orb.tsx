import type { CSSProperties } from "react";
import { ORB_LABEL, type OrbState } from "@/lib/live-answer";
import { cn } from "@/lib/utils";

/** The assistant. Its state comes from stream events; the text label is always shown beside it. */
export function Orb({ state, size = 28, label = true, className }: { state: OrbState; size?: number; label?: boolean; className?: string }) {
  const tone = state === "failed" ? "text-red-text" : state === "done" ? "text-green-text" : "text-text-2";
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)} role="status" aria-live="polite">
      <span className="orb" data-state={state} style={{ "--orb-size": `${size}px` } as CSSProperties} aria-hidden />
      {label && <span className={cn("text-[13px] font-medium", tone)}>{ORB_LABEL[state]}</span>}
    </span>
  );
}
