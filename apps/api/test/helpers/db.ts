import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import postgres from "postgres";
import { createDb, type Db } from "../../src/db/client";
import { runMigrations } from "../../src/db/migrate";

export interface TestDb {
  db: Db;
  url: string;
  stop: () => Promise<void>;
}

/**
 * A real, migrated Postgres for one test file. Uses Testcontainers (pgvector image) by default.
 * If TEST_DATABASE_URL points at a server with pgvector, a throwaway database is created there instead.
 */
export async function startTestDb(): Promise<TestDb> {
  const adminUrl = process.env.TEST_DATABASE_URL;
  return adminUrl ? useExistingServer(adminUrl) : useContainer();
}

async function useContainer(): Promise<TestDb> {
  const container: StartedPostgreSqlContainer = await new PostgreSqlContainer("pgvector/pgvector:pg17").start();
  const url = container.getConnectionUri();
  const handle = createDb(url, { max: 5 });
  await runMigrations(handle.db);
  return {
    db: handle.db,
    url,
    stop: async () => {
      await handle.close();
      await container.stop();
    },
  };
}

async function useExistingServer(adminUrl: string): Promise<TestDb> {
  const name = `cda_test_${crypto.randomUUID().replaceAll("-", "").slice(0, 12)}`;
  const admin = postgres(adminUrl, { max: 1, onnotice: () => undefined });
  await admin.unsafe(`create database ${name}`);
  const url = new URL(adminUrl);
  url.pathname = `/${name}`;
  const handle = createDb(url.toString(), { max: 5 });
  await runMigrations(handle.db);
  return {
    db: handle.db,
    url: url.toString(),
    stop: async () => {
      await handle.close();
      await admin.unsafe(`drop database if exists ${name} with (force)`);
      await admin.end();
    },
  };
}
