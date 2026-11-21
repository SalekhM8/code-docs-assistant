import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** House eyebrow label: 600 10.5px, 0.22em, uppercase, terracotta. */
export function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cn("text-[10.5px] font-semibold uppercase leading-snug tracking-[0.22em] text-eyebrow", className)}>{children}</p>;
}

/** House headline: Fraunces 300 with a coral full stop. */
export function Headline({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <h1 className={cn("font-serif text-[30px] font-light leading-[1.05] tracking-[-0.03em] text-text", className)}>
      {children}
      <span className="text-mark">.</span>
    </h1>
  );
}
