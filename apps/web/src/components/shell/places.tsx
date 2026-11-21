"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import type { RepoSummary } from "@cda/shared";
import { useActivity } from "@/components/activity";
import { AddRepoForm } from "@/components/sidebar/add-repo-form";
import { ConfirmButton } from "@/components/sidebar/confirm-button";
import { ROOM_COLORS } from "@/lib/floor";
import { useConversations, useCreateConversation, useDeleteConversation, useRepos } from "@/lib/queries";
import { progressPercent } from "@/lib/repo-status";
import { cn } from "@/lib/utils";

/** The house's Places card: each repo is a floor (Fraunces name, small caps beside it), its conversations are the rooms under it. */
export function Places({ repoId, conversationId }: { repoId?: string; conversationId?: string }) {
  const repos = useRepos();
  return (
    <nav aria-label="Repos and conversations" className="flex min-h-0 flex-col overflow-y-auto rounded-card bg-surface p-2.5 shadow-card">
      <p className="px-3 pb-2 pt-3 text-[10.5px] font-semibold uppercase tracking-[0.22em] text-eyebrow">Places</p>
      <PlaceRow href="/" label="All repos" sub="The whole floor" on={!repoId} />
      {repos.isPending && <p className="px-3 py-2 text-[13px] text-text-dim">Loading repos…</p>}
      {repos.isError && <p role="alert" className="px-3 py-2 text-[13px] text-red-text">{repos.error.message}</p>}
      <ul aria-label="Repos">
        {repos.data?.map((repo) => (
          <li key={repo.id} className="mt-1 border-t-[1.5px] border-line pt-1">
            <PlaceRow href={`/repos/${repo.id}`} label={`${repo.owner}/${repo.name}`} sub={repoSub(repo)} subTone={repo.status === "failed" ? "text-red-text" : undefined} on={repo.id === repoId && !conversationId} current={repo.id === repoId} />
            {repo.id === repoId && <Rooms repo={repo} conversationId={conversationId} />}
          </li>
        ))}
      </ul>
      {repos.data?.length === 0 && <p className="px-3 py-2 text-[13px] text-text-dim">No repos yet. Add one below.</p>}
      <div className="mt-2 border-t-[1.5px] border-line px-2 pb-2 pt-3">
        <AddRepoForm />
      </div>
    </nav>
  );
}

function repoSub(repo: RepoSummary): string {
  if (repo.status === "indexing") return `Indexing ${progressPercent(repo)}%`;
  if (repo.status === "failed") return "Failed";
  return `${repo.fileCount} files`;
}

function PlaceRow({ href, label, sub, on, current, subTone }: { href: string; label: string; sub: string; on: boolean; current?: boolean; subTone?: string }) {
  return (
    <Link
      href={href}
      aria-current={on || current ? "page" : undefined}
      className={cn("flex min-h-12 items-center justify-between gap-3 rounded-[16px] px-3", on ? "bg-text text-surface" : "text-text hover:bg-surface-2")}
    >
      <span className="min-w-0 truncate font-serif text-[19px] font-light leading-none tracking-[-0.02em]">{label}</span>
      <span className={cn("shrink-0 text-[10px] font-semibold uppercase tracking-[0.2em]", on ? "opacity-70" : (subTone ?? "opacity-70"))}>{sub}</span>
    </Link>
  );
}

/** A repo's conversations, as the rooms of its floor. */
function Rooms({ repo, conversationId }: { repo: RepoSummary; conversationId?: string }) {
  const conversations = useConversations(repo.id);
  const create = useCreateConversation();
  const del = useDeleteConversation(repo.id);
  const router = useRouter();
  const { activity } = useActivity();

  return (
    <div aria-label="Conversations" role="group">
      <ul>
        {conversations.data?.map((c, i) => {
          const on = c.id === conversationId;
          const answering = on && activity.streaming;
          return (
            <li key={c.id} className={cn("group flex min-h-10 items-center gap-2.5 rounded-xl pl-5 pr-1.5", on ? "bg-line" : "hover:bg-surface-2")}>
              <span className="size-[9px] shrink-0 rounded-full" style={{ background: ROOM_COLORS[i % ROOM_COLORS.length] }} aria-hidden />
              <Link href={`/repos/${repo.id}/c/${c.id}`} aria-current={on ? "page" : undefined} className="min-w-0 flex-1 truncate py-2 text-[13.5px] font-medium text-text">
                {c.title}
              </Link>
              {answering ? (
                <span className="shrink-0 text-[12px] font-semibold text-text">Answering</span>
              ) : (
                <span className="shrink-0 text-[12px] text-text-dim group-focus-within:hidden group-hover:hidden">{shortDate(c.updatedAt)}</span>
              )}
              <span className="hidden shrink-0 group-focus-within:flex group-hover:flex">
                <ConfirmButton label="Delete conversation" confirmLabel="Delete?" onConfirm={() => del.mutate(c.id, { onSuccess: () => on && router.push(`/repos/${repo.id}`) })}>
                  <Trash2 />
                </ConfirmButton>
              </span>
            </li>
          );
        })}
      </ul>
      <button
        type="button"
        disabled={repo.status !== "ready" || create.isPending}
        onClick={() => create.mutate(repo.id, { onSuccess: (c) => router.push(`/repos/${repo.id}/c/${c.id}`) })}
        className="flex min-h-10 w-full items-center gap-2.5 rounded-xl pl-5 pr-3 text-left text-[13.5px] font-medium text-text-2 hover:bg-surface-2 disabled:opacity-50"
      >
        <Plus className="size-[13px]" aria-hidden /> New conversation
      </button>
      {create.isError && <p role="alert" className="px-5 text-[12.5px] text-red-text">{create.error.message}</p>}
    </div>
  );
}

function shortDate(iso: string): string {
  const d = new Date(iso);
  const sameDay = d.toDateString() === new Date().toDateString();
  return sameDay ? d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : d.toLocaleDateString([], { day: "numeric", month: "short" });
}
