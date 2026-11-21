import { describe, expect, it } from "vitest";
import { HealthResponse } from "./health";

describe("HealthResponse", () => {
  it("rejects an unknown status", () => {
    const result = HealthResponse.safeParse({ status: "great", db: "ok", providers: { llm: "fake", embeddings: "fake" } });
    expect(result.success).toBe(false);
  });
});
