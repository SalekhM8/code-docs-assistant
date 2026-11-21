import { describe, expect, it } from "vitest";
import { AppError } from "../lib/errors";
import { FakeEmbeddings, VoyageEmbeddings } from "./embeddings";

function fakeFetch(responses: { status: number; body: unknown }[]) {
  const calls: { body: string }[] = [];
  const impl = (async (_url: string, init: { body: string }) => {
    calls.push({ body: init.body });
    const r = responses.shift() ?? { status: 500, body: {} };
    return new Response(JSON.stringify(r.body), { status: r.status });
  }) as unknown as typeof fetch;
  return { impl, calls };
}

describe("VoyageEmbeddings", () => {
  it("sends the input type and returns vectors in input order", async () => {
    const { impl, calls } = fakeFetch([{ status: 200, body: { data: [{ embedding: [2], index: 1 }, { embedding: [1], index: 0 }] } }]);
    const voyage = new VoyageEmbeddings({ apiKey: "k", model: "voyage-code-4", fetchImpl: impl });
    expect(await voyage.embed(["a", "b"], "query")).toEqual([[1], [2]]);
    expect(JSON.parse(calls[0]?.body ?? "{}")).toMatchObject({ input_type: "query", model: "voyage-code-4" });
  });

  it("retries rate limits and then gives a clear error", async () => {
    const { impl, calls } = fakeFetch([{ status: 429, body: {} }, { status: 401, body: {} }]);
    const voyage = new VoyageEmbeddings({ apiKey: "k", model: "m", fetchImpl: impl, maxAttempts: 3 });
    await expect(voyage.embed(["a"], "document")).rejects.toThrow(/VOYAGE_API_KEY/);
    expect(calls).toHaveLength(2);
  });

  it("rejects a malformed body", async () => {
    const { impl } = fakeFetch([{ status: 200, body: { data: [{ embedding: "nope", index: 0 }] } }]);
    await expect(new VoyageEmbeddings({ apiKey: "k", model: "m", fetchImpl: impl }).embed(["a"], "document")).rejects.toBeInstanceOf(AppError);
  });
});

describe("FakeEmbeddings", () => {
  it("gives similar texts closer vectors than unrelated ones", async () => {
    const [a, b, c] = await new FakeEmbeddings().embed(["parse command options", "parseOptions for a command", "render the html page"]);
    const dot = (x: number[] = [], y: number[] = []) => x.reduce((s, v, i) => s + v * (y[i] ?? 0), 0);
    expect(dot(a, b)).toBeGreaterThan(dot(a, c));
  });
});
