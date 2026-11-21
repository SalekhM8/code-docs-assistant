"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { RotateCw, Trash2 } from "lucide-react";
import type { AnswerMode } from "@cda/shared";
import { Composer } from "@/components/chat/composer";
import { Markdown } from "@/components/chat/markdown";
import { Eyebrow } from "@/components/eyebrow";
import { ChipButton, PanelHeader } from "@/components/panel-header";
import { ConfirmButton } from "@/components/sidebar/confirm-button";
import { Button } from "@/components/ui/button";
import { setPendingQuestion } from "@/lib/pending-question";
import { useCreateConversation, useDeleteRepo, useReindexRepo, useRepo } from "@/lib/queries";
import { shortSha } from "@/lib/repo-status";
import { IndexingProgress } from "./indexing-progress";

export function RepoHome({ repoId }: { repoId: string }) {
  const repo = useRepo(repoId);
  const create = useCreateConversation();
  const reindex = useReindexRepo();
  const del = useDeleteRepo();
  const router = useRouter();
  const [mode, setMode] = useState<AnswerMode>("agent");

  const ask = (content: string, mode: AnswerMode) =>
    create.mutate(repoId, {
      onSuccess: (c) => {
        setPendingQuestion(c.id, { content, mode });
        router.push(`/repos/${repoId}/c/${c.id}`);
      },
    });

  if (repo.isPending) return <p className="p-8 text-[14px] text-text-dim">Loading…</p>;
  if (repo.isError) return <p role="alert" className="p-8 text-[14px] text-red-text">{repo.error.message}</p>;
  const r = repo.data;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <PanelHeader eyebrow={r.status === "ready" ? `Indexed at ${shortSha(r.commitSha)} · ${r.fileCount} files · ${r.chunkCount} chunks` : r.owner} title={`${r.owner}/${r.name}`}>
        {r.status !== "indexing" && (
          <div className="mt-3 flex items-center gap-1">
            <Button variant="outline" size="sm" onClick={() => reindex.mutate(r.id)} disabled={reindex.isPending} title="Fetch the latest commit and re-index">
              <RotateCw /> Re-index
            </Button>
            <ConfirmButton label="Delete repo" confirmLabel="Delete this repo?" onConfirm={() => del.mutate(r.id, { onSuccess: () => router.push("/") })}>
              <Trash2 />
            </ConfirmButton>
          </div>
        )}
        {(reindex.isError || del.isError) && <p role="alert" className="mt-2 text-[12.5px] text-red-text">{(reindex.error ?? del.error)?.message}</p>}
      </PanelHeader>

      <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-6 pb-6">
        {r.status === "indexing" && <IndexingProgress repo={r} />}

        {r.status === "failed" && (
          <div role="alert" className="space-y-3 rounded-block border-[1.5px] border-red bg-red-tint p-4">
            <Eyebrow className="text-red-text">Failed</Eyebrow>
            <p className="text-[14.5px] leading-normal text-text">{r.latestJob?.error ?? "The last indexing attempt did not finish."}</p>
            <Button onClick={() => reindex.mutate(r.id)} disabled={reindex.isPending}>Retry</Button>
          </div>
        )}

        {r.status === "ready" && (
          <>
            {r.latestJob?.status === "failed" && (
              <p role="alert" className="rounded-block border-[1.5px] border-red bg-red-tint p-3 text-[13.5px] text-red-text">
                The last re-index failed: {r.latestJob.error} The previous index is still in use.
              </p>
            )}
            <section aria-label="Overview">
              <Eyebrow className="mb-2">Overview</Eyebrow>
              {r.overview ? <Markdown text={r.overview} repoId={r.id} citations={null} /> : <p className="text-text-dim">No overview yet.</p>}
            </section>
          </>
        )}
      </div>

      {r.status === "ready" && (
        <div className="border-t-[1.5px] border-line p-4">
          {r.suggestedQuestions.length > 0 && (
            <section className="mb-3 flex flex-wrap gap-1.5" aria-label="Suggested questions">
              {r.suggestedQuestions.slice(0, 4).map((q) => (
                <ChipButton key={q} onClick={() => ask(q, mode)} disabled={create.isPending}>
                  {q}
                </ChipButton>
              ))}
            </section>
          )}
          <Composer mode={mode} onModeChange={setMode} onSend={ask} streaming={false} onStop={() => undefined} busy={create.isPending} placeholder={`Ask about ${r.name}`} />
          {create.isError && <p role="alert" className="mt-2 text-[13px] text-red-text">{create.error.message}</p>}
        </div>
      )}
    </div>
  );
}
