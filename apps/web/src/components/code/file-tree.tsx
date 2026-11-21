"use client";

import { useVirtualizer } from "@tanstack/react-virtual";
import { useMemo, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { useDebounced } from "@/hooks/use-debounced";
import { useFiles } from "@/lib/queries";
import { cn } from "@/lib/utils";

const ROW = 30;

/** Every indexed file, filterable (debounced) and virtualised, since repos can have thousands. */
export function FileTree({ repoId, activePath, onOpen }: { repoId: string; activePath?: string; onOpen: (path: string) => void }) {
  const files = useFiles(repoId, true);
  const [filter, setFilter] = useState("");
  const query = useDebounced(filter.trim().toLowerCase(), 150);
  const visible = useMemo(() => (files.data ?? []).filter((f) => !query || f.path.toLowerCase().includes(query)), [files.data, query]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({ count: visible.length, getScrollElement: () => scrollRef.current, estimateSize: () => ROW, overscan: 12 });

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="border-b-[1.5px] border-line p-3">
        <Input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Filter files" aria-label="Filter files" className="h-9 rounded-full border-[1.5px] border-line-strong bg-surface-2 px-4" />
        <p className="mt-1.5 px-1 text-[12px] text-text-dim">{files.isPending ? "Loading files…" : `${visible.length} of ${files.data?.length ?? 0} files`}</p>
      </div>
      {files.isError && <p role="alert" className="p-3 text-[13px] text-red-text">{files.error.message}</p>}
      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto">
        <ul className="relative" style={{ height: virtualizer.getTotalSize() }} aria-label="Files">
          {virtualizer.getVirtualItems().map((item) => {
            const f = visible[item.index];
            if (!f) return null;
            return (
              <li key={f.path} className="absolute inset-x-0" style={{ height: ROW, transform: `translateY(${item.start}px)` }}>
                <button
                  type="button"
                  onClick={() => onOpen(f.path)}
                  className={cn("flex h-full w-full items-center gap-2 px-4 text-left font-mono text-[12.5px] hover:bg-surface-2", f.path === activePath && "bg-surface-2 font-semibold")}
                >
                  <span className="min-w-0 flex-1 truncate">{f.path}</span>
                  <span className="shrink-0 text-[11px] text-text-dim">{f.lineCount}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
