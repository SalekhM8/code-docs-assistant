"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { RotateCw, Trash2 } from "lucide-react";
import type { RepoSummary } from "@cda/shared";
import { Button } from "@/components/ui/button";
import { Orb } from "@/components/orb";
import { useDeleteRepo, useReindexRepo, useRepos } from "@/lib/queries";
import { progressPercent, stageLabel } from "@/lib/repo-status";
import { cn } from "@/lib/utils";
import { ConfirmButton } from "./confirm-button";

export function RepoList({ activeRepoId }: { activeRepoId?: string }) {
  const repos = useRepos();
  if (repos.isPending) return <p className="px-1 text-[13px] text-text-dim">Loading repos…</p>;
  if (repos.isError) return <p role="alert" className="px-1 text-[13px] text-red-text">{repos.error.message}</p>;
  if (repos.data.length === 0) return <p className="px-1 text-[13px] text-text-dim">No repos yet. Add one above.</p>;
  return (
    <ul className="space-y-1" aria-label="Repos">
      {repos.data.map((repo) => (
        <RepoItem key={repo.id} repo={repo} active={repo.id === activeRepoId} />
      ))}
    </ul>
  );
}

function RepoItem({ repo, active }: { repo: RepoSummary; active: boolean }) {
  const reindex = useReindexRepo();
  const del = useDeleteRepo();
  const router = useRouter();
  return (
    <li className={cn("group rounded-item px-3 py-2", active ? "bg-surface-2 ring-[1.5px] ring-line" : "hover:bg-surface-2")}>
      <div className="flex items-center gap-2">
        <Link href={`/repos/${repo.id}`} className="min-w-0 flex-1 rounded-sm" aria-current={active ? "page" : undefined}>
          <span className="block truncate text-[14px] font-semibold text-text">{repo.owner}/{repo.name}</span>
          <RepoStatusLine repo={repo} />
        </Link>
        {active && repo.status !== "indexing" && (
          <span className="flex items-center">
            <Button variant="ghost" size="icon-sm" title="Re-index: fetch the latest commit" aria-label="Re-index" disabled={reindex.isPending} onClick={() => reindex.mutate(repo.id)}>
              <RotateCw />
            </Button>
            <ConfirmButton label="Delete repo" confirmLabel="Delete?" onConfirm={() => del.mutate(repo.id, { onSuccess: () => router.push("/") })}>
              <Trash2 />
            </ConfirmButton>
          </span>
        )}
      </div>
      {(reindex.isError || del.isError) && <p role="alert" className="mt-1 text-[12.5px] text-red-text">{(reindex.error ?? del.error)?.message}</p>}
    </li>
  );
}

function RepoStatusLine({ repo }: { repo: RepoSummary }) {
  if (repo.status === "indexing") {
    return (
      <span className="mt-1 flex items-center gap-2 text-[12.5px] text-text-2">
        <Orb state="searching" size={10} label={false} />
        {stageLabel(repo.latestJob?.stage ?? "queued")} · {progressPercent(repo)}%
      </span>
    );
  }
  if (repo.status === "failed") return <span className="mt-0.5 block text-[12.5px] text-red-text">Indexing failed</span>;
  const lastFailed = repo.latestJob?.status === "failed";
  return (
    <span className="mt-0.5 flex items-center gap-1.5 text-[12.5px] text-text-dim">
      <span className="size-2 rounded-full bg-green" aria-hidden />
      Ready · {repo.fileCount} files{lastFailed && <span className="text-red-text"> · last re-index failed</span>}
    </span>
  );
}
