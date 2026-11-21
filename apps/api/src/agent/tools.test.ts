import { describe, expect, it } from "vitest";
import { ContextBudget } from "./budget";
import { normalisePath, TOOL_SPECS } from "./tools";

describe("normalisePath", () => {
  it.each([
    ["lib/command.js", "lib/command.js"],
    ["./lib//command.js", "lib/command.js"],
    ["/etc/passwd", "etc/passwd"],
    ["../../secret", "secret"],
    ["", ""],
  ])("%s -> %s", (input, expected) => {
    expect(normalisePath(input)).toBe(expected);
  });
});

describe("tool specs", () => {
  it("are strict, closed objects with every property required", () => {
    for (const spec of TOOL_SPECS) {
      expect(spec.inputSchema).toMatchObject({ type: "object", additionalProperties: false });
      expect(spec.inputSchema.required).toEqual(Object.keys(spec.inputSchema.properties as object));
    }
  });
});

describe("ContextBudget", () => {
  it("truncates each result and refuses more once the total is spent", () => {
    const budget = new ContextBudget(30, 20);
    expect(budget.fit("x".repeat(25))).toMatch(/^x{20}\n\[truncated: 5 more/);
    expect(budget.fit("y".repeat(15))).toMatch(/^y{10}\n\[truncated/);
    expect(budget.exhausted).toBe(true);
    expect(budget.fit("z")).toMatch(/budget for tool results is used up/);
  });
});
