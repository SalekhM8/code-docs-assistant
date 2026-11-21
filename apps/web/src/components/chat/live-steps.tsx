import { Check, FileText, FolderTree, Search, X } from "lucide-react";
import type { LiveStep, StepKind } from "@cda/shared";
import { cn } from "@/lib/utils";

const ICON: Record<StepKind, typeof Search> = { search: Search, symbol: Search, read: FileText, list: FolderTree };
const VERB: Record<StepKind, string> = { search: "Search", symbol: "Find symbol", read: "Read", list: "List" };

/** Each search and file open as it happens, straight from `step` events. */
export function LiveSteps({ steps }: { steps: LiveStep[] }) {
  if (steps.length === 0) return null;
  return (
    <ol className="space-y-1" aria-label="What the assistant is doing">
      {steps.map((s) => {
        const Icon = ICON[s.kind];
        const failed = s.detail === "failed";
        return (
          <li key={s.id} className="flex min-w-0 items-center gap-2 text-[13px] text-text-2">
            <Icon className="size-3.5 shrink-0 text-brand-text" aria-hidden />
            <span className="shrink-0 font-medium">{VERB[s.kind]}</span>
            <span className="min-w-0 truncate font-mono text-[12px]">{s.label}</span>
            <span className={cn("ml-auto flex shrink-0 items-center gap-1 text-[12px]", failed ? "text-red-text" : "text-text-dim")}>
              {s.done ? (failed ? <X className="size-3" aria-hidden /> : <Check className="size-3" aria-hidden />) : null}
              {s.done ? s.detail : "working"}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
