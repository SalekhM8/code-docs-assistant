import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { HealthResponse } from "@cda/shared";
import { createApp } from "../src/app";
import { createLogger } from "../src/lib/logger";
import { startTestDb, type TestDb } from "./helpers/db";

let testDb: TestDb;

beforeAll(async () => {
  testDb = await startTestDb();
});
afterAll(async () => {
  await testDb.stop();
});

describe("GET /health", () => {
  it("reports ok when the database answers, and echoes the request id", async () => {
    const app = createApp({
      config: { CORS_ORIGIN: "http://localhost:3000" },
      db: testDb.db,
      log: createLogger("silent"),
      providerNames: { llm: "fake", embeddings: "fake" },
    });
    const res = await app.request("/health", { headers: { "x-request-id": "test-request-1234" } });
    expect(res.status).toBe(200);
    expect(res.headers.get("x-request-id")).toBe("test-request-1234");
    expect(HealthResponse.parse(await res.json()).db).toBe("ok");
  });
});
