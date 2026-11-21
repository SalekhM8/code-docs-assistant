import type { ReactNode } from "react";
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

/** The house's ghost pill, used for suggested questions. */
export function ChipButton({ children, onClick, disabled }: { children: ReactNode; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="min-h-10 max-w-full rounded-full border-[1.5px] border-line-strong px-3.5 py-2 text-left text-[13px] font-semibold leading-snug text-text hover:border-text disabled:opacity-50"
    >
      {children}
    </button>
  );
}
