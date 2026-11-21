"use client";

import { useVirtualizer } from "@tanstack/react-virtual";
import { useEffect, useRef, type ReactNode } from "react";

/**
 * Virtualised: only messages near the viewport are mounted, so long conversations stay fast.
 * Heights are measured as rows render (and re-measured while an answer streams). It sticks
 * to the bottom unless the user has scrolled up to read.
 */
export function MessageList({ rows, followKey }: { rows: { key: string; node: ReactNode }[]; followKey: string }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const atBottom = useRef(true);
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 160,
    overscan: 6,
    getItemKey: (i) => rows[i]?.key ?? i,
  });

  useEffect(() => {
    if (atBottom.current && rows.length > 0) virtualizer.scrollToIndex(rows.length - 1, { align: "end" });
  }, [followKey, rows.length, virtualizer]);

  return (
    <div
      ref={scrollRef}
      className="min-h-0 flex-1 overflow-y-auto"
      onScroll={(e) => {
        const el = e.currentTarget;
        atBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
      }}
    >
      <div className="relative mx-auto w-full max-w-3xl px-6" style={{ height: virtualizer.getTotalSize() }}>
        {virtualizer.getVirtualItems().map((item) => (
          <div key={item.key} data-index={item.index} ref={virtualizer.measureElement} className="absolute left-6 right-6 py-3" style={{ transform: `translateY(${item.start}px)` }}>
            {rows[item.index]?.node}
          </div>
        ))}
      </div>
    </div>
  );
}
