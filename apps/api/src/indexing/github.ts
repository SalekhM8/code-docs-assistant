import { z } from "zod";
import { AppError } from "../lib/errors";

export interface RepoRef {
  owner: string;
  name: string;
  /** Canonical form, used as the unique key: https://github.com/owner/name */
  url: string;
}

const NAME = /^[A-Za-z0-9_.-]{1,100}$/;

/** Accepts only https github.com repo URLs. No other hosts, ports, credentials or sub-paths beyond the repo. */
export function parseGitHubUrl(input: string): RepoRef {
  const invalid = new AppError("invalid_repo_url", "Paste a public GitHub repo URL like https://github.com/owner/repo.");
  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    throw invalid;
  }
  if (url.protocol !== "https:" || url.hostname !== "github.com" || url.port || url.username || url.password) throw invalid;
  const [owner, rawName, ...rest] = url.pathname.split("/").filter(Boolean);
  const name = rawName?.replace(/\.git$/, "");
  if (!owner || !name || !NAME.test(owner) || !NAME.test(name) || name === "." || name === "..") throw invalid;
  // Allow links copied from the browser such as /tree/main, but nothing that names another repo.
  if (rest.length > 0 && !["tree", "blob"].includes(rest[0] ?? "")) throw invalid;
  return { owner, name, url: `https://github.com/${owner}/${name}` };
}

export interface RepoMetadata {
  isPrivate: boolean;
  sizeKb: number;
  defaultBranch: string;
}

export interface GitHubClient {
  getRepo(ref: RepoRef): Promise<RepoMetadata>;
}

const GitHubRepo = z.object({ private: z.boolean(), size: z.number(), default_branch: z.string() });

export class GitHubApi implements GitHubClient {
  constructor(private readonly token?: string, private readonly fetchImpl: typeof fetch = fetch) {}

  async getRepo(ref: RepoRef): Promise<RepoMetadata> {
    const res = await this.fetchImpl(`https://api.github.com/repos/${ref.owner}/${ref.name}`, {
      headers: {
        accept: "application/vnd.github+json",
        "user-agent": "code-docs-assistant",
        ...(this.token ? { authorization: `Bearer ${this.token}` } : {}),
      },
    }).catch((cause: unknown) => {
      throw new AppError("provider_error", "Could not reach GitHub. Check the network and try again.", { cause });
    });
    if (res.status === 404) {
      throw new AppError("repo_not_found", `${ref.owner}/${ref.name} was not found on GitHub. Check the URL; private repos are not supported.`);
    }
    if (res.status === 403 || res.status === 429) {
      throw new AppError("rate_limited", "GitHub's API rate limit was reached. Wait a few minutes, or set GITHUB_TOKEN in .env.");
    }
    if (!res.ok) throw new AppError("provider_error", `GitHub answered with status ${res.status}. Try again shortly.`);
    const body = GitHubRepo.safeParse(await res.json());
    if (!body.success) throw new AppError("provider_error", "GitHub returned an unexpected response. Try again shortly.");
    return { isPrivate: body.data.private, sizeKb: body.data.size, defaultBranch: body.data.default_branch };
  }
}

export function assertWithinLimits(meta: RepoMetadata, maxSizeMb: number, ref: RepoRef): void {
  if (meta.isPrivate) {
    throw new AppError("repo_not_found", `${ref.owner}/${ref.name} is private. Only public repos are supported.`);
  }
  const sizeMb = meta.sizeKb / 1024;
  if (sizeMb > maxSizeMb) {
    throw new AppError("repo_too_large", `${ref.owner}/${ref.name} is about ${Math.round(sizeMb)} MB; the limit is ${maxSizeMb} MB. Try a smaller repo.`);
  }
}
