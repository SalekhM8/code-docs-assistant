"use client";

import type { ReactNode } from "react";
import type { TraceDetail } from "@cda/shared";
import { Eyebrow } from "@/components/eyebrow";
import { usePanels } from "@/components/panels";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { useTrace } from "@/lib/queries";
import { formatCost, formatMs, parseRef, summariseTrace } from "@/lib/trace-view";

/** Per-answer trace: what was searched, which files were opened, tokens, cost and time. All from the stored trace. */
export function TraceDrawer({ repoId }: { repoId: string | undefined }) {
  const { traceId, closeTrace } = usePanels();
  const trace = useTrace(traceId);
  return (
    <Sheet open={traceId !== null} onOpenChange={(open) => !open && closeTrace()}>
      <SheetContent side="right" className="w-full gap-0 overflow-y-auto bg-surface p-0 sm:max-w-[460px]">
        <div className="border-b-[1.5px] border-line px-5 py-4">
          <Eyebrow>Trace</Eyebrow>
          <SheetTitle className="font-serif text-[22px] font-light tracking-[-0.02em]">How this answer was made<span className="text-mark">.</span></SheetTitle>
          <SheetDescription className="sr-only">Searches, files opened, tokens, cost and timing for one answer.</SheetDescription>
        </div>
        {trace.isPending && <p className="p-5 text-[13px] text-text-dim">Loading trace…</p>}
        {trace.isError && <p role="alert" className="p-5 text-[13px] text-red-text">{trace.error.message}</p>}
        {trace.data && <TraceBody trace={trace.data} repoId={repoId} />}
      </SheetContent>
    </Sheet>
  );
}

function TraceBody({ trace, repoId }: { trace: TraceDetail; repoId: string | undefined }) {
  const summary = summariseTrace(trace);
  const longest = Math.max(1, ...trace.steps.map((s) => s.durationMs));
  return (
    <div className="space-y-6 p-5">
      <dl className="grid grid-cols-3 gap-3">
        <Stat label="Time" value={formatMs(trace.durationMs)} />
        <Stat label="Tokens" value={summary.totalTokens.toLocaleString()} />
        <Stat label="Cost" value={formatCost(trace.costUsd)} />
        <Stat label="Mode" value={trace.mode} />
        <Stat label="Model calls" value={String(summary.modelCalls)} />
        <Stat label="Outcome" value={trace.outcome.replace("_", " ")} />
      </dl>
      <p className="text-[12.5px] text-text-dim">
        {trace.inputTokens.toLocaleString()} input · {trace.outputTokens.toLocaleString()} output · {trace.cacheReadTokens.toLocaleString()} cache read · {trace.cacheWriteTokens.toLocaleString()} cache write · {trace.model} · prompt {trace.promptVersion}
      </p>

      <Section title={`Searches (${summary.searches.length})`}>
        {summary.searches.length === 0 && <p className="text-[13px] text-text-dim">None.</p>}
        {summary.searches.map((s, i) => (
          <div key={i} className="space-y-1 rounded-item border-[1.5px] border-line p-3">
            <p className="text-[13px]"><span className="font-semibold">{s.tool}</span> <span className="font-mono text-[12px]">“{s.label}”</span></p>
            <p className="text-[12px] text-text-dim">{s.refs.length} results · {formatMs(s.durationMs)}</p>
            <div className="flex flex-wrap gap-1">{s.refs.map((r) => <RefChip key={r} refText={r} repoId={repoId} />)}</div>
          </div>
        ))}
      </Section>

      <Section title={`Files opened (${summary.filesOpened.length})`}>
        {summary.filesOpened.length === 0 ? <p className="text-[13px] text-text-dim">None.</p> : <div className="flex flex-wrap gap-1">{summary.filesOpened.map((r) => <RefChip key={r} refText={r} repoId={repoId} />)}</div>}
      </Section>

      <Section title="Steps">
        <ol className="space-y-1.5">
          {trace.steps.map((s) => (
            <li key={s.position} className="grid grid-cols-[1fr_auto] items-center gap-x-3 text-[12.5px]">
              <span className="min-w-0 truncate"><span className="text-text-dim">{s.kind}</span> · <span className="font-medium">{s.name}</span>{s.inputTokens + s.outputTokens > 0 && <span className="text-text-dim"> · {s.inputTokens + s.outputTokens} tokens</span>}</span>
              <span className="tabular-nums text-text-dim">{formatMs(s.durationMs)}</span>
              <span className="col-span-2 h-1 rounded-full bg-surface-2"><span className="block h-full rounded-full bg-brand" style={{ width: `${(100 * s.durationMs) / longest}%` }} /></span>
            </li>
          ))}
        </ol>
      </Section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-item bg-surface-2 px-3 py-2">
      <dt className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-text-dim">{label}</dt>
      <dd className="truncate text-[14px] font-semibold tabular-nums">{value}</dd>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-2">
      <h3 className="text-[10.5px] font-semibold uppercase tracking-[0.22em] text-eyebrow">{title}</h3>
      {children}
    </section>
  );
}

function RefChip({ refText, repoId }: { refText: string; repoId: string | undefined }) {
  const { openCode } = usePanels();
  const target = parseRef(refText);
  return (
    <button
      type="button"
      disabled={!target || !repoId}
      onClick={() => target && repoId && openCode({ repoId, ...target })}
      className="rounded-full border-[1.5px] border-brand/40 px-2 py-px font-mono text-[11.5px] text-brand-text hover:border-brand"
    >
      {refText}
    </button>
  );
}
