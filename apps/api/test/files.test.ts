import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { FileContent, FileList } from "@cda/shared";
import { buildTestApp, indexFixture, type TestApp } from "./helpers/app";
import { startTestDb, type TestDb } from "./helpers/db";

let testDb: TestDb;
let t: TestApp;
let repoId: string;
beforeAll(async () => {
  testDb = await startTestDb();
  t = await buildTestApp(testDb.db);
  repoId = await indexFixture(t);
});
afterAll(async () => {
  await testDb.stop();
});

describe("file routes", () => {
  it("lists indexed files in path order", async () => {
    const list = FileList.parse(await (await t.app.request(`/repos/${repoId}/files`)).json());
    expect(list.map((f) => f.path)).toContain("src/math.ts");
    expect(list.find((f) => f.path === "src/util.ts")).toMatchObject({ language: "typescript", lineCount: 4 });
  });

  it("returns one file's content with the commit it came from", async () => {
    const file = FileContent.parse(await (await t.app.request(`/repos/${repoId}/file?path=src/util.ts`)).json());
    expect(file.content).toContain("export function round");
    expect(file.commitSha).toBe("sha-1");
  });

  it("404s on a path that is not indexed", async () => {
    expect((await t.app.request(`/repos/${repoId}/file?path=../../etc/passwd`)).status).toBe(404);
    expect((await t.app.request(`/repos/${repoId}/file`)).status).toBe(400);
  });
});
