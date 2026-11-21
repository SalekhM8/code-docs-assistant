import { describe, expect, it } from "vitest";
import { AppError } from "../lib/errors";
import { assertWithinLimits, parseGitHubUrl } from "./github";

describe("parseGitHubUrl", () => {
  it.each([
    ["https://github.com/tj/commander.js", "https://github.com/tj/commander.js"],
    ["https://github.com/tj/commander.js.git", "https://github.com/tj/commander.js"],
    ["  https://github.com/tj/commander.js/tree/master  ", "https://github.com/tj/commander.js"],
  ])("normalises %s", (input, expected) => {
    expect(parseGitHubUrl(input).url).toBe(expected);
  });

  it.each(["https://github.com/tj", "https://github.com.evil.com/a/b", "https://github.com:8443/a/b", "https://github.com/a/b/settings", "ssh://git@github.com/a/b", "https://github.com/a/.."])(
    "rejects %s",
    (input) => {
      expect(() => parseGitHubUrl(input)).toThrow(AppError);
    },
  );
});

describe("assertWithinLimits", () => {
  const ref = parseGitHubUrl("https://github.com/a/b");
  it("passes a small public repo and rejects a big one", () => {
    expect(() => assertWithinLimits({ isPrivate: false, sizeKb: 1024, defaultBranch: "main" }, 10, ref)).not.toThrow();
    expect(() => assertWithinLimits({ isPrivate: false, sizeKb: 20 * 1024, defaultBranch: "main" }, 10, ref)).toThrow(/limit is 10 MB/);
  });
});
