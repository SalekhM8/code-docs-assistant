"use client";

import type { Citation } from "@cda/shared";
import { usePanels } from "@/components/panels";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { CiteTarget } from "@/lib/citations";
import { cn } from "@/lib/utils";

/** A clickable citation. The checker's verdict decides its look; failures are flagged, never hidden. */
export function CitationChip({ target, verdict, repoId }: { target: CiteTarget; verdict: Citation | undefined; repoId: string }) {
  const { openCode } = usePanels();
  const invalid = verdict?.valid === false;
  const missingFile = invalid && verdict.reason?.startsWith("This file is not");
  const range = target.startLine === target.endLine ? `${target.startLine}` : `${target.startLine}-${target.endLine}`;
  const chip = (
    <button
      type="button"
      disabled={missingFile}
      onClick={() => openCode({ repoId, path: target.path, startLine: target.startLine, endLine: target.endLine })}
      className={cn(
        "mx-0.5 inline-flex max-w-full items-baseline gap-1 rounded-full border-[1.5px] px-2 py-px align-baseline font-mono text-[12px] font-medium",
        invalid ? "border-red/60 bg-red-tint text-red-text" : "border-brand/40 bg-surface text-brand-text hover:border-brand hover:bg-surface-2",
        missingFile && "cursor-not-allowed",
      )}
      aria-label={`${invalid ? "Unverified citation" : "Open"} ${target.path} lines ${range}`}
    >
      {invalid && <span aria-hidden>!</span>}
      <span className="truncate">{target.path}</span>
      <span className="text-text-dim">:{range}</span>
    </button>
  );
  if (!invalid) return chip;
  return (
    <Tooltip>
      <TooltipTrigger asChild>{chip}</TooltipTrigger>
      <TooltipContent>Citation check failed: {verdict.reason}</TooltipContent>
    </Tooltip>
  );
}
