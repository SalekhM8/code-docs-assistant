import { existsSync, readFileSync } from "node:fs";
import { parseEnv } from "node:util";
import { defineConfig } from "vitest/config";

// Only TEST_* variables from the root .env reach tests, so a real key can never leak into one.
function testEnv(): Record<string, string> {
  const file = new URL("../../.env", import.meta.url);
  if (!existsSync(file)) return {};
  const all = parseEnv(readFileSync(file, "utf8"));
  return Object.fromEntries(Object.entries(all).filter((e): e is [string, string] => e[0].startsWith("TEST_") && Boolean(e[1])));
}

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts", "test/**/*.test.ts"],
    env: testEnv(),
    testTimeout: 30_000,
    hookTimeout: 120_000,
  },
});
