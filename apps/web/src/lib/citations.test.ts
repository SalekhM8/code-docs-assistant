import { describe, expect, it } from "vitest";
import { linkifyCitations, parseCiteHref } from "./citations";

describe("linkifyCitations", () => {
  it("links citations in prose but not inside code", () => {
    const md = "Parses args [lib/command.js:10-20]. Use `[a.ts:1]` or\n```\n[b.ts:2]\n```\nsee [c.md:3].";
    expect(linkifyCitations(md)).toBe(
      "Parses args [lib/command.js:10-20](#cite=lib%2Fcommand.js%3A10-20). Use `[a.ts:1]` or\n```\n[b.ts:2]\n```\nsee [c.md:3](#cite=c.md%3A3).",
    );
  });

  it("links paths with square brackets and spaces", () => {
    expect(linkifyCitations("See [app/users/[id]/page.tsx:3-9] and [my notes.md:2].")).toBe(
      "See [app/users/\\[id\\]/page.tsx:3-9](#cite=app%2Fusers%2F%5Bid%5D%2Fpage.tsx%3A3-9) and [my notes.md:2](#cite=my%20notes.md%3A2).",
    );
    expect(parseCiteHref("#cite=app%2Fusers%2F%5Bid%5D%2Fpage.tsx%3A3-9")).toEqual({ path: "app/users/[id]/page.tsx", startLine: 3, endLine: 9 });
  });

  it("leaves existing markdown links alone", () => {
    expect(linkifyCitations("[docs:1](http://x)")).toBe("[docs:1](http://x)");
  });
});

describe("parseCiteHref", () => {
  it("round-trips a range and a single line", () => {
    expect(parseCiteHref("#cite=lib%2Fa.js%3A10-20")).toEqual({ path: "lib/a.js", startLine: 10, endLine: 20 });
    expect(parseCiteHref("#cite=a.ts%3A7")).toEqual({ path: "a.ts", startLine: 7, endLine: 7 });
    expect(parseCiteHref("https://example.com")).toBeNull();
  });
});
