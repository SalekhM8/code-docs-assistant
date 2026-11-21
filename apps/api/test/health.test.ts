import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { HealthResponse } from "@cda/shared";
import { buildTestApp, type TestApp } from "./helpers/app";
import { startTestDb, type TestDb } from "./helpers/db";

let testDb: TestDb;
let t: TestApp;

beforeAll(async () => {
  testDb = await startTestDb();
  t = await buildTestApp(testDb.db);
});
afterAll(async () => {
  await testDb.stop();
});

describe("GET /health", () => {
  it("reports ok when the database answers, and echoes the request id", async () => {
    const res = await t.app.request("/health", { headers: { "x-request-id": "test-request-1234" } });
    expect(res.status).toBe(200);
    expect(res.headers.get("x-request-id")).toBe("test-request-1234");
    expect(HealthResponse.parse(await res.json()).db).toBe("ok");
  });

  it("replaces a malformed request id instead of logging it", async () => {
    const res = await t.app.request("/health", { headers: { "x-request-id": "bad id\n" } });
    expect(res.headers.get("x-request-id")).toMatch(/^[0-9a-f-]{36}$/);
  });
});
