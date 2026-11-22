import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { eq, sql } from "drizzle-orm";
import type { ConversationDetail, Message, StreamEvent } from "@cda/shared";
import { messages, traceSteps, traces } from "../src/db/schema";
import { FakeLlm, type FakeTurnScript } from "../src/providers/fake-llm";
import type { TurnRequest } from "../src/providers/llm";
import { ask, buildTestApp, indexFixture, json, newConversation, parseSse, readEvents } from "./helpers/app";
import { startTestDb, type TestDb } from "./helpers/db";

let testDb: TestDb;
beforeAll(async () => {
  testDb = await startTestDb();
});
afterAll(async () => {
  await testDb.stop();
});
beforeEach(async () => {
  await testDb.db.execute(sql`truncate repos, embedding_cache cascade`);
});

async function setup(turn: (req: TurnRequest, i: number) => FakeTurnScript, options: { rateLimit?: number } = {}) {
  const llm = new FakeLlm({ turn, complete: () => "Calculator questions" });
  const t = await buildTestApp(testDb.db, { llm, ...options });
  const repoId = await indexFixture(t);
  return { t, llm, repoId, conversationId: await newConversation(t, repoId) };
}

const done = (events: StreamEvent[]): Message => {
  const last = events.at(-1);
  if (last?.type !== "done") throw new Error(`expected a done event, got ${JSON.stringify(last)}`);
  return last.message;
};

describe("baseline answers over SSE", () => {
  it("streams a cited answer and stores the message and its trace", async () => {
    const { t, llm, conversationId } = await setup(() => ({ text: "Use `add` to sum two numbers [src/math.ts:3-6]." }));
    const res = await ask(t, conversationId, "How do I add two numbers?");
    expect(res.headers.get("content-type")).toContain("text/event-stream");
    const events = await readEvents(res);

    expect(events.map((e) => e.type)).toEqual(["start", "status", "step", "step", "status", ...Array(7).fill("text"), "done"]);
    expect(events.filter((e) => e.type === "status").map((e) => e.type === "status" && e.state)).toEqual(["searching", "answering"]);
    const message = done(events);
    expect(message.status).toBe("complete");
    expect(message.citations).toEqual([{ path: "src/math.ts", startLine: 3, endLine: 6, valid: true }]);

    // The retrieved code reached the model, wrapped as untrusted data with line numbers.
    const prompt = JSON.stringify(llm.turnRequests[0]?.messages);
    expect(prompt).toContain("<repo_data");
    expect(prompt).toContain("4| export function add");
    expect(llm.turnRequests[0]?.system[0]?.cache).toBe(true);

    const [trace] = await testDb.db.select().from(traces).where(eq(traces.messageId, message.id));
    expect(trace).toMatchObject({ mode: "baseline", outcome: "complete", promptVersion: "answer.v2" });
    const steps = await testDb.db.select().from(traceSteps).where(eq(traceSteps.traceId, trace?.id ?? ""));
    expect(steps.map((s) => s.kind)).toEqual(["retrieval", "model", "citation_check"]);

    const convo = await json<ConversationDetail>(await t.app.request(`/conversations/${conversationId}`));
    expect(convo.messages.map((m) => m.role)).toEqual(["user", "assistant"]);
    expect(convo.messages[1]?.traceId).toBe(trace?.id);
  });

  it("flags citations to files or lines that were not retrieved", async () => {
    const { t, conversationId } = await setup(() => ({ text: "See [src/math.ts:3-6], [src/missing.ts:1-2] and [src/math.ts:3-999]." }));
    const message = done(await readEvents(await ask(t, conversationId, "How do I add two numbers?")));
    expect(message.status).toBe("complete");
    expect(message.citations.map((c) => [c.valid, c.reason])).toEqual([
      [true, undefined],
      [false, "This file is not in the indexed repo."],
      [false, "Lines are out of range (the file has 24 lines)."],
    ]);
  });

  it("says plainly when nothing was found, and shows what it searched", async () => {
    const { t, conversationId } = await setup(() => ({ text: "NOT_FOUND: There is no database code in this repo." }));
    const message = done(await readEvents(await ask(t, conversationId, "Which database does it use?")));
    expect(message.status).toBe("not_found");
    expect(message.content).toBe("There is no database code in this repo.");
    expect(message.searched).toEqual(['Searched for "Which database does it use?"']);
  });

  it("keeps checked citations in a not-found explanation", async () => {
    const { t, conversationId } = await setup(() => ({ text: "NOT_FOUND: Nothing adds matrices. The closest thing is `add` [src/math.ts:3-6]." }));
    const message = done(await readEvents(await ask(t, conversationId, "How do I add two matrices?")));
    expect(message.status).toBe("not_found");
    expect(message.citations).toEqual([{ path: "src/math.ts", startLine: 3, endLine: 6, valid: true }]);
  });

  it("resolves a shortened path to the one retrieved file it can mean", async () => {
    const { t, conversationId } = await setup(() => ({ text: "Use `add` [math.ts:3-6]." }));
    const message = done(await readEvents(await ask(t, conversationId, "How do I add two numbers?")));
    expect(message.content).toBe("Use `add` [src/math.ts:3-6].");
    expect(message.citations).toEqual([{ path: "src/math.ts", startLine: 3, endLine: 6, valid: true }]);
  });

  it("refuses a second question while the first is still being answered", async () => {
    const { t, conversationId } = await setup(() => ({ text: "Sum [src/math.ts:3-6]" }));
    const [a, b] = await Promise.all([ask(t, conversationId, "How do I add?"), ask(t, conversationId, "And multiply?")]);
    expect([a.status, b.status].sort()).toEqual([200, 409]);
    const busy = a.status === 409 ? a : b;
    expect((await json<{ error: { code: string } }>(busy)).error.code).toBe("conversation_busy");
    await readEvents(a.status === 200 ? a : b);
    // The claim is released when the answer ends.
    expect((await ask(t, conversationId, "And multiply?")).status).toBe(200);
  });

  it("withholds an answer that cites nothing", async () => {
    const { t, conversationId } = await setup(() => ({ text: "It probably uses Postgres." }));
    const message = done(await readEvents(await ask(t, conversationId, "Which database does it use?")));
    expect(message.status).toBe("not_found");
    expect(message.content).toMatch(/could not back an answer/);
  });

  it("keeps conversation context for follow-ups", async () => {
    const { t, llm, conversationId } = await setup((_req, i) => ({ text: i === 0 ? "`Calculator` keeps a total [src/math.ts:10-23]." : "It rounds with `round` [src/util.ts:1-4]." }));
    await readEvents(await ask(t, conversationId, "What does the Calculator class do?"));
    await readEvents(await ask(t, conversationId, "How does it round?"));
    const second = llm.turnRequests[1]?.messages ?? [];
    expect(second.map((m) => m.role)).toEqual(["user", "assistant", "user"]);
    expect(second[1]).toMatchObject({ role: "assistant", text: expect.stringContaining("keeps a total") });
  });

  it("stops mid stream and stores the partial answer", async () => {
    const long = `${"word ".repeat(400)}[src/math.ts:3-6]`;
    const { t, conversationId } = await setup(() => ({ text: long }));
    const res = await ask(t, conversationId, "How do I add two numbers?");
    const reader = res.body?.getReader();
    let seen = "";
    while (reader && !seen.includes('"type":"text"')) seen += new TextDecoder().decode((await reader.read()).value);
    await reader?.cancel();

    await expect.poll(async () => (await testDb.db.select().from(messages).where(eq(messages.role, "assistant")))[0]?.status, { timeout: 5000 }).toBe("stopped");
    const [stored] = await testDb.db.select().from(messages).where(eq(messages.role, "assistant"));
    expect(stored?.content.length).toBeGreaterThan(0);
    expect(stored?.content.length).toBeLessThan(long.length);
  });

  it("regenerates the last answer in place", async () => {
    const { t, conversationId } = await setup((_req, i) => ({ text: `Answer ${i} [src/math.ts:3-6]` }));
    await readEvents(await ask(t, conversationId, "How do I add two numbers?"));
    const events = parseSse(await (await t.app.request(`/conversations/${conversationId}/regenerate`, { method: "POST", body: "{}" })).text());
    expect(done(events).content).toBe("Answer 1 [src/math.ts:3-6]");
    const convo = await json<ConversationDetail>(await t.app.request(`/conversations/${conversationId}`));
    expect(convo.messages.map((m) => m.content)).toEqual(["How do I add two numbers?", "Answer 1 [src/math.ts:3-6]"]);
  });

  it("titles a conversation after its first answer", async () => {
    const { t, conversationId } = await setup(() => ({ text: "Sum [src/math.ts:3-6]" }));
    await readEvents(await ask(t, conversationId, "How do I add two numbers?"));
    await expect.poll(async () => (await json<ConversationDetail>(await t.app.request(`/conversations/${conversationId}`))).title).toBe("Calculator questions");
  });
});

describe("answer endpoint guards", () => {
  it("rejects an empty question with a clear message", async () => {
    const { t, conversationId } = await setup(() => ({ text: "x" }));
    const res = await ask(t, conversationId, "   ");
    expect(res.status).toBe(400);
    expect(await res.text()).toContain("Type a question first.");
  });

  it("rate limits each client", async () => {
    const { t, conversationId } = await setup(() => ({ text: "Sum [src/math.ts:3-6]" }), { rateLimit: 1 });
    await readEvents(await ask(t, conversationId, "How do I add two numbers?"));
    const res = await ask(t, conversationId, "And multiply?");
    expect(res.status).toBe(429);
    expect(res.headers.get("retry-after")).toBeTruthy();
  });

  it("deletes a conversation with its messages and traces", async () => {
    const { t, conversationId } = await setup(() => ({ text: "Sum [src/math.ts:3-6]" }));
    await readEvents(await ask(t, conversationId, "How do I add two numbers?"));
    expect((await t.app.request(`/conversations/${conversationId}`, { method: "DELETE" })).status).toBe(204);
    const left = await testDb.db.execute<{ n: number }>(sql`select (select count(*) from messages) + (select count(*) from traces) + (select count(*) from trace_steps) as n`);
    expect(Number(left[0]?.n)).toBe(0);
  });
});
