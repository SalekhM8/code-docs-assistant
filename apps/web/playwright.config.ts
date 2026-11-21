import { defineConfig, devices } from "@playwright/test";

/**
 * One browser test of the reviewer journey. It starts its own api (fake model and embeddings,
 * seeding the pinned sample repo, which needs network access to GitHub) and web app on
 * separate ports, against E2E_DATABASE_URL.
 */
const API_PORT = 8788;
const WEB_PORT = 3100;
const DATABASE_URL = process.env.E2E_DATABASE_URL ?? "postgres://postgres:postgres@localhost:5432/cda_e2e";

export default defineConfig({
  testDir: "./e2e",
  timeout: 180_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: { baseURL: `http://localhost:${WEB_PORT}`, trace: "retain-on-failure", ...devices["Desktop Chrome"] },
  webServer: [
    {
      command: "pnpm --filter @cda/api start",
      url: `http://localhost:${API_PORT}/health`,
      timeout: 120_000,
      reuseExistingServer: false,
      env: {
        DATABASE_URL,
        PORT: String(API_PORT),
        CORS_ORIGIN: `http://localhost:${WEB_PORT}`,
        LLM_PROVIDER: "fake",
        EMBEDDING_PROVIDER: "fake",
        SEED_SAMPLE_REPO: "true",
        FAKE_STREAM_DELAY_MS: "60",
        RATE_LIMIT_PER_MINUTE: "1000",
        LOG_LEVEL: "warn",
      },
    },
    {
      command: `pnpm exec next dev --port ${WEB_PORT}`,
      url: `http://localhost:${WEB_PORT}`,
      timeout: 120_000,
      reuseExistingServer: false,
      env: { NEXT_PUBLIC_API_URL: `http://localhost:${API_PORT}`, NEXT_TELEMETRY_DISABLED: "1" },
    },
  ],
});
