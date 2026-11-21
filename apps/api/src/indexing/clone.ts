import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { AppError } from "../lib/errors";

const run = promisify(execFile);

export interface Cloner {
  /** Shallow clones `url` into `dir` (an empty folder) and returns the commit sha checked out. */
  clone(url: string, dir: string, commit: string | null, signal?: AbortSignal): Promise<string>;
}

// No prompts, no LFS downloads, symlinks checked out as plain files so nothing can point outside the clone.
const GIT_ENV = { ...process.env, GIT_TERMINAL_PROMPT: "0", GIT_LFS_SKIP_SMUDGE: "1", GIT_CONFIG_NOSYSTEM: "1" };
const SAFE = ["-c", "core.symlinks=false", "-c", "protocol.allow=never", "-c", "protocol.https.allow=always"];

export class GitCloner implements Cloner {
  constructor(private readonly timeoutMs = 120_000) {}

  async clone(url: string, dir: string, commit: string | null, signal?: AbortSignal): Promise<string> {
    if (commit) {
      // A shallow fetch of one commit keeps the pinned sample repo as cheap as a normal shallow clone.
      await this.git(["init", "-q", dir], signal);
      await this.git(["-C", dir, "fetch", "-q", "--depth", "1", url, commit], signal);
      await this.git(["-C", dir, "checkout", "-q", "FETCH_HEAD"], signal);
    } else {
      await this.git(["clone", "-q", "--depth", "1", "--single-branch", "--no-tags", url, dir], signal);
    }
    const { stdout } = await this.git(["-C", dir, "rev-parse", "HEAD"], signal);
    return stdout.trim();
  }

  private async git(args: string[], signal?: AbortSignal) {
    try {
      return await run("git", [...SAFE, ...args], { env: GIT_ENV, timeout: this.timeoutMs, signal, maxBuffer: 1024 * 1024 });
    } catch (cause) {
      if (signal?.aborted) throw cause;
      throw new AppError("provider_error", "Cloning the repo failed. Check that it is public and reachable, then retry.", { cause });
    }
  }
}
