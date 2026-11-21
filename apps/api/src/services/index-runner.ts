import { inArray } from "drizzle-orm";
import type { Db } from "../db/client";
import { indexJobs } from "../db/schema";
import { runIndexJob, type IndexingDeps, type IndexRequest } from "../indexing/pipeline";

/**
 * Runs index jobs in this process, at most `concurrency` at a time. Deliberately not a
 * queue service: job state lives in `index_jobs`, and a restart marks interrupted jobs failed.
 */
export class IndexRunner {
  private readonly controllers = new Map<string, AbortController>();
  private readonly inFlight = new Set<Promise<void>>();
  private readonly waiting: (() => void)[] = [];
  private active = 0;

  constructor(private readonly deps: IndexingDeps, private readonly concurrency = 2) {}

  start(req: IndexRequest): void {
    const controller = new AbortController();
    this.controllers.set(req.repoId, controller);
    const task = this.withSlot(() => runIndexJob(this.deps, req, controller.signal)).finally(() => {
      this.controllers.delete(req.repoId);
      this.inFlight.delete(task);
    });
    this.inFlight.add(task);
  }

  isRunning(repoId: string): boolean {
    return this.controllers.has(repoId);
  }

  /** Stops a repo's job, used before the repo is deleted. */
  cancel(repoId: string): void {
    this.controllers.get(repoId)?.abort(new Error("repo deleted"));
  }

  /** Resolves when no job is running. Used by tests and graceful shutdown. */
  async idle(): Promise<void> {
    while (this.inFlight.size > 0) await Promise.all(this.inFlight);
  }

  private async withSlot(fn: () => Promise<void>): Promise<void> {
    if (this.active >= this.concurrency) await new Promise<void>((resolve) => this.waiting.push(resolve));
    this.active++;
    try {
      await fn();
    } finally {
      this.active--;
      this.waiting.shift()?.();
    }
  }
}

/** Jobs left running by a previous process can never finish; mark them failed so the UI offers retry. */
export async function failInterruptedJobs(db: Db): Promise<number> {
  const rows = await db
    .update(indexJobs)
    .set({ status: "failed", stage: "failed", error: "The api restarted while this job was running. Retry it.", finishedAt: new Date() })
    .where(inArray(indexJobs.status, ["queued", "running"]))
    .returning({ id: indexJobs.id });
  return rows.length;
}
