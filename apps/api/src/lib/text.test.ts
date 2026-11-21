import { describe, expect, it } from "vitest";
import { countLines, identifierWords } from "./text";

describe("identifierWords", () => {
  it("splits camelCase, snake_case and acronyms, keeping the whole identifier too", () => {
    expect(identifierWords("parseOptions HTTPServer max_retry_count")).toEqual(
      expect.arrayContaining(["parse", "options", "parseoptions", "http", "server", "max", "retry", "count", "max_retry_count"]),
    );
  });
});

describe("countLines", () => {
  it("does not count a trailing newline as a line", () => {
    expect(countLines("a\nb\n")).toBe(2);
    expect(countLines("a\nb")).toBe(2);
    expect(countLines("")).toBe(0);
  });
});
