"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActivity } from "@/components/activity";
import { useConversation, useCreateConversation, useRepo, useRepos } from "@/lib/queries";
import { cn } from "@/lib/utils";

/** The house's top right: where you are, the live counts, and one dark action pill. */
export function TopBar({ repoId, conversationId }: { repoId?: string; conversationId?: string }) {
  const repos = useRepos();
  const repo = useRepo(repoId);
  const conversation = useConversation(conversationId);
  const { activity, stop } = useActivity();
  const create = useCreateConversation();
  const router = useRouter();

  const readyRepoId = repo.data?.status === "ready" ? repo.data.id : null;
  const list = repos.data ?? [];
  const working = list.filter((r) => r.status === "indexing").length + (activity.streaming ? 1 : 0);
  const ready = list.filter((r) => r.status === "ready").length;
  const failed = list.filter((r) => r.status === "failed").length;

  const crumbs = [
    { label: "Repos", href: "/" },
    ...(repo.data ? [{ label: `${repo.data.owner}/${repo.data.name}`, href: `/repos/${repo.data.id}` }] : []),
    ...(conversation.data && repoId ? [{ label: conversation.data.title, href: `/repos/${repoId}/c/${conversation.data.id}` }] : []),
  ];

  return (
    <div className="pointer-events-none absolute right-0 top-0 z-30 flex items-center justify-end gap-2 p-5">
      <nav aria-label="Where you are" className="pointer-events-auto flex min-h-12 max-w-[460px] items-center rounded-full px-2 glass">
        {crumbs.map((c, i) => (
          <span key={c.href} className={cn("flex items-center", i === crumbs.length - 1 ? "min-w-0" : "shrink-0")}>
            {i > 0 && <span className="px-0.5 opacity-35">/</span>}
            <Link
              href={c.href}
              aria-current={i === crumbs.length - 1 ? "page" : undefined}
              className={cn("flex min-h-10 min-w-0 items-center truncate rounded-full px-3 text-[13.5px]", i === crumbs.length - 1 ? "font-semibold text-text" : "font-medium text-text-dim")}
            >
              <span className="truncate">{c.label}</span>
            </Link>
          </span>
        ))}
      </nav>
      <div className="pointer-events-auto flex min-h-12 items-center gap-4 glass rounded-full px-[18px] text-[13.5px] font-medium tabular-nums" role="status" aria-label="Activity">
        <span className="flex items-center gap-2">
          <Dot className="bg-text" /> Working <b>{working}</b>
        </span>
        <span className="flex items-center gap-2 text-green-text">
          <Dot className="bg-green" /> Ready <b>{ready}</b>
        </span>
        <span className={cn("flex items-center gap-2", failed ? "text-red-text" : "text-text")}>
          <Dot className={failed ? "bg-red" : "bg-line-strong"} /> Failed <b>{failed}</b>
        </span>
      </div>
      {stop ? (
        <button type="button" onClick={stop} className="pointer-events-auto min-h-12 bead rounded-full px-5 text-[14px] font-semibold" title="Stop the answer (Escape)">
          Stop answering
        </button>
      ) : readyRepoId ? (
        <button
          type="button"
          disabled={create.isPending}
          onClick={() => create.mutate(readyRepoId, { onSuccess: (c) => router.push(`/repos/${c.repoId}/c/${c.id}`) })}
          className="pointer-events-auto min-h-12 bead rounded-full px-5 text-[14px] font-semibold disabled:opacity-60"
        >
          New conversation
        </button>
      ) : (
        <button type="button" onClick={() => document.getElementById("repo-url")?.focus()} className="pointer-events-auto min-h-12 bead rounded-full px-5 text-[14px] font-semibold">
          Add a repo
        </button>
      )}
    </div>
  );
}

function Dot({ className }: { className: string }) {
  return <span className={cn("inline-block size-[9px] shrink-0 rounded-full", className)} aria-hidden />;
}
