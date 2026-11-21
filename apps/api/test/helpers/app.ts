import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { createApp } from "../../src/app";
import type { Db } from "../../src/db/client";
import type { Cloner } from "../../src/indexing/clone";
import type { GitHubClient, RepoMetadata } from "../../src/indexing/github";
import { createLogger } from "../../src/lib/logger";
import type { Providers } from "../../src/providers";
import { FakeEmbeddings } from "../../src/providers/embeddings";
import { FakeLlm } from "../../src/providers/fake-llm";
import { createServices, type Services } from "../../src/services/container";

export const FIXTURE_DIR = new URL("../fixtures/sample-repo", import.meta.url).pathname;
export const FIXTURE_URL = "https://github.com/acme/sample-calculator";

/** A cloner that writes an in-memory file tree, so tests control exactly what each "commit" contains. */
export class FixtureCloner implements Cloner {
  calls = 0;
  failWith: Error | null = null;
  constructor(public files: Record<string, string | Buffer>, public sha = "sha-1") {}

  static async fromFixture(): Promise<FixtureCloner> {
    return new FixtureCloner(await readTree(FIXTURE_DIR));
  }

  async clone(_url: string, dir: string): Promise<string> {
    this.calls++;
    if (this.failWith) throw this.failWith;
    for (const [rel, content] of Object.entries(this.files)) {
      await mkdir(path.dirname(path.join(dir, rel)), { recursive: true });
      await writeFile(path.join(dir, rel), content);
    }
    return this.sha;
  }
}

async function readTree(root: string, rel = ""): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  for (const entry of await readdir(path.join(root, rel), { withFileTypes: true })) {
    const child = rel ? `${rel}/${entry.name}` : entry.name;
    if (entry.isDirectory()) Object.assign(out, await readTree(root, child));
    else out[child] = await readFile(path.join(root, child), "utf8");
  }
  return out;
}

export class FakeGitHub implements GitHubClient {
  meta: RepoMetadata = { isPrivate: false, sizeKb: 12, defaultBranch: "main" };
  async getRepo(): Promise<RepoMetadata> {
    return this.meta;
  }
}

/** Counts texts sent for embedding, to prove re-index only embeds what changed. */
export class CountingEmbeddings extends FakeEmbeddings {
  embedded = 0;
  override async embed(texts: string[]): Promise<number[][]> {
    this.embedded += texts.length;
    return super.embed(texts);
  }
}

export interface TestApp {
  app: ReturnType<typeof createApp>;
  services: Services;
  providers: Providers & { embeddings: CountingEmbeddings; llm: FakeLlm };
  cloner: FixtureCloner;
  github: FakeGitHub;
}

export async function buildTestApp(db: Db, options: { llm?: FakeLlm } = {}): Promise<TestApp> {
  const log = createLogger("silent");
  const providers = { llm: options.llm ?? new FakeLlm(), embeddings: new CountingEmbeddings() };
  const cloner = await FixtureCloner.fromFixture();
  const github = new FakeGitHub();
  const config = { MAX_REPO_SIZE_MB: 50, MAX_FILE_COUNT: 500, MAX_FILE_BYTES: 200_000 };
  const services = await createServices({ config, db, log, providers, cloner, github });
  const app = createApp({ config: { CORS_ORIGIN: "http://localhost:3000" }, db, log, providerNames: { llm: "fake", embeddings: "fake" }, services });
  return { app, services, providers, cloner, github };
}

export async function json<T>(res: Response): Promise<T> {
  return (await res.json()) as T;
}
