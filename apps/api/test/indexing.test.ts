import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { eq, sql } from "drizzle-orm";
import type { ApiErrorBody, RepoDetail } from "@cda/shared";
import { chunks, files, indexVersions, repos } from "../src/db/schema";
import { FIXTURE_URL, buildTestApp, json, type TestApp } from "./helpers/app";
import { startTestDb, type TestDb } from "./helpers/db";

let testDb: TestDb;
let t: TestApp;

beforeAll(async () => {
  testDb = await startTestDb();
});
afterAll(async () => {
  await testDb.stop();
});
beforeEach(async () => {
  await testDb.db.execute(sql`truncate repos, embedding_cache cascade`);
  t = await buildTestApp(testDb.db);
});

async function addRepo(): Promise<RepoDetail> {
  const res = await t.app.request("/repos", { method: "POST", body: JSON.stringify({ url: `${FIXTURE_URL}.git` }) });
  expect(res.status).toBe(202);
  const repo = await json<RepoDetail>(res);
  await t.services.runner.idle();
  return t.services.repos.get(repo.id);
}

async function indexedPaths(repoId: string): Promise<string[]> {
  const [repo] = await testDb.db.select().from(repos).where(eq(repos.id, repoId));
  const rows = await testDb.db.select({ path: files.path }).from(files).where(eq(files.versionId, repo?.activeVersionId ?? ""));
  return rows.map((r) => r.path).sort();
}

describe("indexing a repo", () => {
  it("indexes the fixture, skipping secrets, lock files, binaries, vendored and build output", async () => {
    t.cloner.files[".env"] = "API_KEY=abc";
    t.cloner.files["package-lock.json"] = "{}";
    t.cloner.files["node_modules/left-pad/index.js"] = "module.exports = 1;";
    t.cloner.files["dist/bundle.js"] = "var a=1;";
    t.cloner.files["assets/logo.ts"] = Buffer.from([0x89, 0x50, 0x00, 0x01]);
    t.cloner.files["src/keys.ts"] = "const k = `-----BEGIN RSA PRIVATE KEY-----`;";

    const repo = await addRepo();

    expect(repo.status).toBe("ready");
    expect(repo.url).toBe(FIXTURE_URL);
    expect(repo.latestJob?.stage).toBe("done");
    expect(repo.commitSha).toBe("sha-1");
    expect(await indexedPaths(repo.id)).toEqual(["README.md", "config/app.yaml", "docs/guide.md", "package.json", "src/math.ts", "src/server.py", "src/util.ts"]);
    expect(repo.overview).toBeTruthy();
    expect(repo.suggestedQuestions.length).toBeGreaterThan(0);

    const symbols = await testDb.db.select({ symbol: chunks.symbol, model: chunks.embeddingModel }).from(chunks).where(eq(chunks.path, "src/math.ts"));
    expect(symbols.map((s) => s.symbol)).toEqual(expect.arrayContaining(["add", "multiply", "Calculator"]));
    expect(new Set(symbols.map((s) => s.model))).toEqual(new Set(["fake-hash-embeddings"]));
  });

  it("re-indexes only changed files and swaps in the new version", async () => {
    const first = await addRepo();
    const embeddedFirst = t.providers.embeddings.embedded;
    const [oldVersion] = await testDb.db.select().from(indexVersions).where(eq(indexVersions.repoId, first.id));

    t.cloner.sha = "sha-2";
    t.cloner.files["src/util.ts"] += "\nexport const VERSION = 2;\n";
    const res = await t.app.request(`/repos/${first.id}/reindex`, { method: "POST" });
    expect(res.status).toBe(202);
    await t.services.runner.idle();
    const second = await t.services.repos.get(first.id);

    expect(second.commitSha).toBe("sha-2");
    expect(second.latestJob?.kind).toBe("reindex");
    expect(second.latestJob?.progress).toMatchObject({ filesTotal: 7, filesReused: 6 });
    // Only util.ts was chunked again, and of its chunks only the new one needed embedding:
    // `round` is unchanged, so its vector came from the embedding cache.
    const utilChunks = await testDb.db.select({ symbol: chunks.symbol }).from(chunks).where(eq(chunks.path, "src/util.ts"));
    expect(utilChunks).toHaveLength(2);
    expect(t.providers.embeddings.embedded - embeddedFirst).toBe(1);
    const versions = await testDb.db.select().from(indexVersions).where(eq(indexVersions.repoId, first.id));
    expect(versions.map((v) => v.id)).not.toContain(oldVersion?.id);
    expect(versions).toHaveLength(1);
    expect(second.chunkCount).toBeGreaterThan(0);
  });

  it("does no work when the commit has not changed", async () => {
    const repo = await addRepo();
    const embedded = t.providers.embeddings.embedded;
    await t.services.repos.reindex(repo.id);
    await t.services.runner.idle();
    const after = await t.services.repos.get(repo.id);
    expect(after.latestJob?.status).toBe("ready");
    expect(t.providers.embeddings.embedded).toBe(embedded);
  });

  it("reuses cached embeddings for identical chunks", async () => {
    const repo = await addRepo();
    await t.app.request(`/repos/${repo.id}`, { method: "DELETE" });
    const embedded = t.providers.embeddings.embedded;
    await addRepo();
    expect(t.providers.embeddings.embedded).toBe(embedded);
  });

  it("stores a clear failure and lets the user retry", async () => {
    t.cloner.failWith = new Error("network down");
    const failed = await addRepo();
    expect(failed.status).toBe("failed");
    expect(failed.latestJob?.error).toMatch(/Retry/);

    t.cloner.failWith = null;
    await t.app.request(`/repos/${failed.id}/reindex`, { method: "POST" });
    await t.services.runner.idle();
    expect((await t.services.repos.get(failed.id)).status).toBe("ready");
  });

  it("deletes a repo and all of its data", async () => {
    const repo = await addRepo();
    const res = await t.app.request(`/repos/${repo.id}`, { method: "DELETE" });
    expect(res.status).toBe(204);
    const counts = await testDb.db.execute<{ n: number }>(sql`
      select (select count(*) from repos) + (select count(*) from index_versions) + (select count(*) from files)
           + (select count(*) from chunks) + (select count(*) from index_jobs) as n`);
    expect(Number(counts[0]?.n)).toBe(0);
    expect((await t.app.request(`/repos/${repo.id}`)).status).toBe(404);
  });
});

describe("POST /repos validation", () => {
  it.each([
    ["http://github.com.evil.com/a/b"],
    ["https://gitlab.com/a/b"],
    ["https://github.com/a"],
    ["https://user:pw@github.com/a/b"],
    ["not a url"],
  ])("rejects %s with a message the user can act on", async (url) => {
    const res = await t.app.request("/repos", { method: "POST", body: JSON.stringify({ url }) });
    expect(res.status).toBe(400);
    const body = await json<ApiErrorBody>(res);
    expect(body.error.code).toBe("invalid_repo_url");
    expect(body.error.message).toMatch(/github\.com\/owner\/repo/);
  });

  it("rejects private and oversized repos before cloning", async () => {
    t.github.meta = { isPrivate: false, sizeKb: 900 * 1024, defaultBranch: "main" };
    const big = await t.app.request("/repos", { method: "POST", body: JSON.stringify({ url: FIXTURE_URL }) });
    expect(big.status).toBe(413);
    t.github.meta = { isPrivate: true, sizeKb: 1, defaultBranch: "main" };
    const priv = await t.app.request("/repos", { method: "POST", body: JSON.stringify({ url: FIXTURE_URL }) });
    expect(priv.status).toBe(404);
    expect(t.cloner.calls).toBe(0);
  });
});
