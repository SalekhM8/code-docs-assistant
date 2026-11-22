import { describe, expect, it } from "vitest";
import { serializeError } from "./logger";

describe("serializeError", () => {
  it("drops query parameters from database errors, in the message, the stack and the cause", () => {
    const cause = new Error("invalid byte sequence");
    const err = new Error('Failed query: insert into "files" values ($1)\nparams: SECRET FILE CONTENT\n    at fake frame in the content', { cause });
    Object.assign(err, { params: ["SECRET FILE CONTENT"], query: "insert" });
    const out = serializeError(err);
    expect(JSON.stringify(out)).not.toContain("SECRET FILE CONTENT");
    expect(out.message).toBe('Failed query: insert into "files" values ($1)\nparams: [omitted]');
    expect(String(out.stack)).toContain("logger.test.ts");
    expect(out.cause).toMatchObject({ message: "invalid byte sequence" });
    expect(out).not.toHaveProperty("params");
  });

  it("keeps ordinary errors readable and copes with non-errors", () => {
    expect(serializeError(new TypeError("boom"))).toMatchObject({ type: "TypeError", message: "boom" });
    expect(serializeError("plain")).toEqual({ message: "plain" });
  });
});
