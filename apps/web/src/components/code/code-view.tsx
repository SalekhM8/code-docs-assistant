"use client";

import { useEffect, useRef } from "react";
import { useFile } from "@/lib/queries";
import { cn } from "@/lib/utils";
import { useHighlightedLines } from "./highlight";

interface Props {
  repoId: string;
  path: string;
  startLine?: number;
  endLine?: number;
}

/** One file with line numbers; the cited range is highlighted and scrolled into view. */
export function CodeView({ repoId, path, startLine, endLine }: Props) {
  const file = useFile(repoId, path);
  const tokens = useHighlightedLines(file.data?.content, file.data?.language);
  const firstHighlighted = useRef<HTMLDivElement>(null);

  useEffect(() => {
    firstHighlighted.current?.scrollIntoView({ block: "center" });
  }, [file.data, startLine, endLine]);

  if (file.isPending) return <p className="p-4 text-[13px] text-text-dim">Loading {path}…</p>;
  if (file.isError) return <p role="alert" className="p-4 text-[13px] text-red-text">{file.error.message}</p>;

  const lines = file.data.content.split("\n");
  const inRange = (n: number) => startLine !== undefined && n >= startLine && n <= (endLine ?? startLine);
  return (
    <div className="min-h-0 flex-1 overflow-auto bg-surface font-mono text-[12.5px] leading-[1.6]" role="region" aria-label={`Code of ${path}`}>
      <div className="min-w-max py-2">
        {lines.map((line, i) => {
          const n = i + 1;
          const hit = inRange(n);
          return (
            <div key={n} ref={n === startLine ? firstHighlighted : undefined} className={cn("flex pr-4", hit && "bg-[color-mix(in_srgb,var(--accent)_12%,transparent)] shadow-[inset_3px_0_0_var(--accent)]")}>
              <span className={cn("w-14 shrink-0 select-none pr-3 text-right tabular-nums", hit ? "text-brand-text" : "text-text-dim")}>{n}</span>
              <span className="whitespace-pre text-text">
                {tokens?.[i] ? tokens[i].map((t, j) => <span key={j} style={{ color: t.color }}>{t.content}</span>) : line || " "}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
