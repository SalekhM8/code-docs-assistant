"use client";

import Link from "next/link";
import { Eyebrow } from "@/components/eyebrow";
import { Orb } from "@/components/orb";
import { PanelHeader } from "@/components/panel-header";
import { useRepos } from "@/lib/queries";

export function Home() {
  const repos = useRepos();
  const ready = repos.data?.filter((r) => r.status === "ready") ?? [];
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <PanelHeader eyebrow="Code documentation assistant" title="Ask a repo how it works">
        <Orb state="idle" size={18} className="mt-3" />
      </PanelHeader>
      <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-6 pb-6">
        <p className="font-serif text-[21px] font-light leading-[1.3] tracking-[-0.015em]">
          Pick a repo, or paste a public GitHub URL under Places to index one. Every answer cites the exact files and lines it comes from, and each citation opens
          over the floor.
        </p>
        {ready.length > 0 && (
          <section>
            <Eyebrow className="mb-2">Ready to ask</Eyebrow>
            <ul className="flex flex-wrap gap-2">
              {ready.map((r) => (
                <li key={r.id}>
                  <Link href={`/repos/${r.id}`} className="glass-pill flex min-h-10 items-center gap-2 rounded-full px-3.5 text-[13px] font-semibold">
                    <span className="size-[9px] rounded-full bg-green" aria-hidden />
                    Go to {r.owner}/{r.name}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
      <p className="px-6 py-4 text-[11.5px] leading-[1.45] text-text-dim">
        The floor is live: rooms work while a repo indexes, and inside a repo the assistant walks to each folder it searches or reads.
      </p>
    </div>
  );
}
