import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { asc, eq, sql } from "drizzle-orm";
import type { Message, StreamEvent } from "@cda/shared";
import { traceSteps, traces } from "../src/db/schema";
import { FakeLlm, type FakeTurnScript } from "../src/providers/fake-llm";
import type { ToolResult, TurnRequest } from "../src/providers/llm";
import { ask, buildTestApp, indexFixture, newConversation, readEvents } from "./helpers/app";
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

async function run(turn: (req: TurnRequest, i: number) => FakeTurnScript, question = "How does Calculator round its result?") {
  const llm = new FakeLlm({ turn, complete: () => "title" });
  const t = await buildTestApp(testDb.db, { llm, mode: "agent" });
  const conversationId = await newConversation(t, await indexFixture(t));
  const events = await readEvents(await ask(t, conversationId, question));
  const last = events.at(-1);
  if (last?.type !== "done") throw new Error(`no done event: ${JSON.stringify(last)}`);
  return { llm, events, message: last.message as Message };
}

const call = (id: string, name: string, input: unknown) => ({ id, name, input });
const toolResults = (req: TurnRequest | undefined): ToolResult[] => {
  const last = req?.messages.at(-1);
  return last?.role === "tool_results" ? last.results : [];
};

describe("agent mode", () => {
  it("runs tools in parallel, then answers with citations it can back", async () => {
    const { llm, events, message } = await run((_req, i) =>
      i === 0
        ? { toolCalls: [call("c1", "find_symbol", { name: "Calculator" }), call("c2", "read_file", { path: "./src/util.ts", start_line: 1, end_line: 99 })] }
        : { text: "`result()` rounds the total to two places [src/math.ts:20-23] using `round` [src/util.ts:1-4]." },
    );
    expect(message.status).toBe("complete");
    expect(message.citations.every((c) => c.valid)).toBe(true);
    expect(message.searched).toEqual(['Looked up symbol "Calculator"', "Read src/util.ts:1-99"]);

    const results = toolResults(llm.turnRequests[1]);
    expect(results.map((r) => r.toolCallId)).toEqual(["c1", "c2"]);
    expect(results[0]?.content).toContain("### src/math.ts:10-24 (Calculator)");
    expect(results[1]?.content).toContain("4| }");
    expect(llm.turnRequests[0]?.tools?.map((t) => t.name)).toEqual(["search_code", "find_symbol", "read_file", "list_files"]);

    const states = events.flatMap((e) => (e.type === "status" ? [e.state] : []));
    expect(states).toEqual(["searching", "searching", "reading", "answering"]);
    const steps = events.flatMap((e) => (e.type === "step" && e.step.done ? [`${e.step.kind}:${e.step.detail}`] : []));
    expect(steps.sort()).toEqual(["read:lines 1-4", "symbol:1 matches"]);

    const [trace] = await testDb.db.select().from(traces).where(eq(traces.messageId, message.id));
    const kinds = await testDb.db.select({ kind: traceSteps.kind, name: traceSteps.name }).from(traceSteps).where(eq(traceSteps.traceId, trace?.id ?? "")).orderBy(asc(traceSteps.position));
    const names = kinds.map((k) => `${k.kind}:${k.name}`);
    // Parallel tool steps are recorded in the order they finish.
    expect([names[0], ...names.slice(1, 3).sort(), ...names.slice(3)]).toEqual(["model:step 1", "tool:find_symbol", "tool:read_file", "model:step 2", "citation_check:citations"]);
    expect(trace?.mode).toBe("agent");
  });

  it("forces an answer on the sixth step", async () => {
    const { llm, message } = await run((req) =>
      req.toolChoice === "none" ? { text: "NOT_FOUND: I ran out of steps." } : { toolCalls: [call(`c${req.messages.length}`, "search_code", { query: "round" })] },
    );
    expect(llm.turnRequests).toHaveLength(6);
    expect(llm.turnRequests.map((r) => r.toolChoice)).toEqual(["auto", "auto", "auto", "auto", "auto", "none"]);
    expect(message.status).toBe("not_found");
    expect(message.searched).toEqual(['Searched for "round"']);
  });

  it("returns errors for bad tool calls and keeps going", async () => {
    const { llm, message } = await run((_req, i) =>
      i === 0
        ? { toolCalls: [call("a", "read_file", { path: "../../etc/passwd", start_line: 1, end_line: 5 }), call("b", "delete_repo", {}), call("c", "search_code", { query: 42 })] }
        : { text: "NOT_FOUND: nothing useful." },
    );
    const results = toolResults(llm.turnRequests[1]);
    expect(results.map((r) => r.isError)).toEqual([true, true, true]);
    expect(results[0]?.content).toContain('no indexed file at "etc/passwd"');
    expect(message.status).toBe("not_found");
  });

  it("clears narration written before tool calls", async () => {
    const { events, message } = await run((_req, i) =>
      i === 0 ? { text: "Let me look that up.", toolCalls: [call("c1", "find_symbol", { name: "round" })] } : { text: "It uses `round` [src/util.ts:1-4]." },
    );
    const types = events.map((e: StreamEvent) => e.type);
    expect(types.indexOf("reset")).toBeGreaterThan(types.indexOf("text"));
    expect(message.content).toBe("It uses `round` [src/util.ts:1-4].");
  });

  it("does not accept citations to code it only listed", async () => {
    const { message } = await run((_req, i) =>
      i === 0 ? { toolCalls: [call("c1", "list_files", { path: "src" })] } : { text: "Rounding is in [src/util.ts:1-4]." },
    );
    expect(message.citations).toEqual([{ path: "src/util.ts", startLine: 1, endLine: 4, valid: false, reason: "These lines were not retrieved while answering." }]);
    expect(message.status).toBe("not_found");
  });
});
