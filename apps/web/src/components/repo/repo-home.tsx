"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { AnswerMode } from "@cda/shared";
import { Composer } from "@/components/chat/composer";
import { Markdown } from "@/components/chat/markdown";
import { Eyebrow, Headline } from "@/components/eyebrow";
import { Button } from "@/components/ui/button";
import { setPendingQuestion } from "@/lib/pending-question";
import { useCreateConversation, useReindexRepo, useRepo } from "@/lib/queries";
import { shortSha } from "@/lib/repo-status";
import { IndexingProgress } from "./indexing-progress";

export function RepoHome({ repoId }: { repoId: string }) {
  const repo = useRepo(repoId);
  const create = useCreateConversation();
  const retry = useReindexRepo();
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
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-3xl space-y-6 px-6 py-8">
          <div className="space-y-2">
            <Eyebrow>{r.status === "ready" ? `Indexed at ${shortSha(r.commitSha)} · ${r.fileCount} files · ${r.chunkCount} chunks` : "Repository"}</Eyebrow>
            <Headline>{`${r.owner}/${r.name}`}</Headline>
          </div>

          {r.status === "indexing" && <IndexingProgress repo={r} />}

          {r.status === "failed" && (
            <div role="alert" className="space-y-3 rounded-block border-[1.5px] border-red bg-red-tint p-4">
              <p className="text-[15px] font-semibold text-red-text">Indexing failed</p>
              <p className="text-[14px] text-text-2">{r.latestJob?.error ?? "The last indexing attempt did not finish."}</p>
              <Button onClick={() => retry.mutate(r.id)} disabled={retry.isPending}>Retry</Button>
              {retry.isError && <p className="text-[13px] text-red-text">{retry.error.message}</p>}
            </div>
          )}

          {r.status === "ready" && (
            <>
              {r.latestJob?.status === "failed" && (
                <p role="alert" className="rounded-block border-[1.5px] border-red bg-red-tint p-3 text-[13.5px] text-red-text">
                  The last re-index failed: {r.latestJob.error} The previous index is still in use.
                </p>
              )}
              <section className="rounded-card bg-surface p-6 shadow-card" aria-label="Overview">
                <Eyebrow className="mb-3">Overview</Eyebrow>
                {r.overview ? <Markdown text={r.overview} repoId={r.id} citations={null} /> : <p className="text-text-dim">No overview yet.</p>}
              </section>
              {r.suggestedQuestions.length > 0 && (
                <section aria-label="Suggested questions" className="space-y-2">
                  <Eyebrow>Try asking</Eyebrow>
                  <div className="flex flex-wrap gap-2">
                    {r.suggestedQuestions.map((q) => (
                      <Button key={q} variant="outline" className="h-auto min-h-10 max-w-full whitespace-normal text-left text-[13px] font-medium" onClick={() => ask(q, mode)} disabled={create.isPending}>
                        {q}
                      </Button>
                    ))}
                  </div>
                </section>
              )}
            </>
          )}
        </div>
      </div>
      {r.status === "ready" && (
        <div className="border-t-[1.5px] border-line bg-surface px-4 py-3">
          <div className="mx-auto max-w-3xl">
            <Composer mode={mode} onModeChange={setMode} onSend={ask} streaming={false} onStop={() => undefined} busy={create.isPending} placeholder={`Ask about ${r.name}…`} />
            {create.isError && <p role="alert" className="mt-2 text-[13px] text-red-text">{create.error.message}</p>}
          </div>
        </div>
      )}
    </div>
  );
}
