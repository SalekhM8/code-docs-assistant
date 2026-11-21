import type { ReactNode } from "react";
import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

/** The top of the house's side panel: terracotta eyebrow, a big Fraunces headline with a coral full stop, then anything else. */
export function PanelHeader({ eyebrow, title, children, className }: { eyebrow: string; title: string; children?: ReactNode; className?: string }) {
  return (
    <header className={cn("shrink-0 px-6 pb-4 pt-6", className)}>
      <p className="truncate text-[10.5px] font-semibold uppercase leading-snug tracking-[0.22em] text-eyebrow">{eyebrow}</p>
      <h1 className="mt-1 line-clamp-2 break-words font-serif text-[34px] font-light leading-[1.05] tracking-[-0.03em] text-text">
        {title}
        {!/[.?!]$/.test(title) && <span className="text-mark">.</span>}
      </h1>
      {children}
    </header>
  );
}

/** A suggested question: a small glass capsule. */
export function ChipButton({ children, onClick, disabled }: { children: ReactNode; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={typeof children === "string" ? children : undefined}
      className="glass-pill inline-flex min-h-9 max-w-[260px] shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 text-[13px] font-medium text-text disabled:opacity-50"
    >
      <Sparkles className="size-3.5 shrink-0 text-mark" aria-hidden />
      <span className="truncate">{children}</span>
    </button>
  );
}

/** Suggested questions in one row that scrolls sideways, fading at the edges. */
export function ChipRow({ children }: { children: ReactNode }) {
  return (
    <section aria-label="Suggested questions" className="fade-x -mx-4 mb-3 flex gap-2 overflow-x-auto px-4 py-1">
      {children}
    </section>
  );
}
