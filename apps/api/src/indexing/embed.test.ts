import { describe, expect, it } from "vitest";
import { batches } from "./embed";

describe("embedding batches", () => {
  it("splits by item count", () => {
    const items = Array.from({ length: 300 }, () => ({ text: "x" }));
    expect(batches(items).map((b) => b.length)).toEqual([128, 128, 44]);
  });

  it("splits by estimated tokens", () => {
    const items = Array.from({ length: 20 }, () => ({ text: "y".repeat(20_000) }));
    expect(batches(items).length).toBeGreaterThan(1);
  });
});
