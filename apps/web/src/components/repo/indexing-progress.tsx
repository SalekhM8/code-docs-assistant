import type { RepoSummary } from "@cda/shared";
import { Orb } from "@/components/orb";
import { progressPercent, stageLabel } from "@/lib/repo-status";

/** Driven by the job row the api updates at each stage; the orb works while the job does. */
export function IndexingProgress({ repo }: { repo: RepoSummary }) {
  const job = repo.latestJob;
  const percent = progressPercent(repo);
  return (
    <div className="space-y-4 rounded-block border-[1.5px] border-line bg-surface p-5">
      <div className="flex items-center justify-between gap-4">
        <Orb state="searching" label={false} />
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-semibold">{stageLabel(job?.stage ?? "queued")}</p>
          <p className="text-[13px] text-text-dim">
            {job && job.progress.filesTotal > 0
              ? `${job.progress.filesDone} of ${job.progress.filesTotal} files${job.progress.filesReused ? ` (${job.progress.filesReused} unchanged, reused)` : ""} · ${job.progress.chunks} chunks embedded`
              : "This usually takes under a minute for a small repo."}
          </p>
        </div>
        <span className="text-[13px] font-medium tabular-nums text-text-2">{percent}%</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-surface-2" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent} aria-label="Indexing progress">
        <div className="h-full rounded-full bg-brand transition-[width] duration-500 ease-house" style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}
