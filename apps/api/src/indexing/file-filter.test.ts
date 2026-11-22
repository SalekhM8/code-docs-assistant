import { describe, expect, it } from "vitest";
import { isIgnoredDir, skipByContent, skipByPath } from "./file-filter";

describe("file filter", () => {
  it.each([
    ["package-lock.json", "lock_file"],
    ["sub/.env.production", "secret"],
    ["certs/server.pem", "secret"],
    ["static/app.min.js", "minified"],
    ["src/index.ts", null],
  ])("classifies %s by path", (p, reason) => {
    expect(skipByPath(p, 100, 1000)).toBe(reason);
  });

  it("skips oversized files", () => {
    expect(skipByPath("src/big.ts", 2000, 1000)).toBe("too_large");
  });

  it("detects binaries, embedded private keys and minified bundles by content", () => {
    expect(skipByContent(Buffer.from([1, 2, 0, 3]))).toBe("binary");
    // A NUL far past git's 8 KB sniff window still cannot be stored as Postgres text.
    expect(skipByContent(Buffer.concat([Buffer.from("plain text line\n".repeat(2000)), Buffer.from([0])]))).toBe("binary");
    expect(skipByContent(Buffer.from("x\n-----BEGIN OPENSSH PRIVATE KEY-----\n"))).toBe("secret");
    expect(skipByContent(Buffer.from(`var a=${"1+".repeat(4000)}1;`))).toBe("minified");
    expect(skipByContent(Buffer.from("export const a = 1;\n"))).toBeNull();
  });

  it("never descends into dependency or build folders", () => {
    expect(isIgnoredDir("node_modules")).toBe(true);
    expect(isIgnoredDir("src")).toBe(false);
  });
});
