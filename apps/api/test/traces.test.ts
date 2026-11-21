import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { ConversationDetail, TraceDetail } from "@cda/shared";
import { FakeLlm } from "../src/providers/fake-llm";
import { ask, buildTestApp, indexFixture, newConversation, readEvents, type TestApp } from "./helpers/app";
import { startTestDb, type TestDb } from "./helpers/db";

let testDb: TestDb;
let t: TestApp;
let traceId: string;
let conversationId: string;

beforeAll(async () => {
  testDb = await startTestDb();
  await testDb.db.execute(sql`truncate repos cascade`);
  t = await buildTestApp(testDb.db, { llm: new FakeLlm({ turn: () => ({ text: "Sum [src/math.ts:3-6]" }) }) });
  conversationId = await newConversation(t, await indexFixture(t));
  const done = (await readEvents(await ask(t, conversationId, "How do I add two numbers?"))).at(-1);
  traceId = done?.type === "done" ? (done.message.traceId ?? "") : "";
});
afterAll(async () => {
  await testDb.stop();
});

describe("trace and feedback", () => {
  it("returns the recorded steps, tokens and timing for an answer", async () => {
    const trace = TraceDetail.parse(await (await t.app.request(`/traces/${traceId}`)).json());
    expect(trace).toMatchObject({ mode: "baseline", outcome: "complete", model: "fake-answer", feedback: null });
    expect(trace.steps.map((s) => s.kind)).toEqual(["retrieval", "model", "citation_check"]);
    expect(trace.steps[0]?.output.refs).toEqual(expect.arrayContaining(["src/math.ts:3-6"]));
    expect(trace.inputTokens).toBeGreaterThan(0);
    expect(trace.costUsd).toBe(0);
  });

  it("stores one rating per trace, replaces it, and clears it", async () => {
    const put = (rating: string) => t.app.request(`/traces/${traceId}/feedback`, { method: "PUT", body: JSON.stringify({ rating }) });
    expect((await put("up")).status).toBe(200);
    expect((await put("down")).status).toBe(200);
    const convo = ConversationDetail.parse(await (await t.app.request(`/conversations/${conversationId}`)).json());
    expect(convo.messages[1]?.feedback).toBe("down");
    await t.app.request(`/traces/${traceId}/feedback`, { method: "DELETE" });
    expect(TraceDetail.parse(await (await t.app.request(`/traces/${traceId}`)).json()).feedback).toBeNull();
    expect((await put("sideways")).status).toBe(400);
  });

  it("404s for an unknown trace", async () => {
    const res = await t.app.request("/traces/00000000-0000-4000-8000-000000000000/feedback", { method: "PUT", body: JSON.stringify({ rating: "up" }) });
    expect(res.status).toBe(404);
  });
});
