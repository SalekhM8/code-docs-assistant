import { fileURLToPath } from "node:url";
import path from "node:path";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import type { Db } from "./client";
import { createDb } from "./client";

const MIGRATIONS = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../drizzle");

export async function runMigrations(db: Db): Promise<void> {
  await migrate(db, { migrationsFolder: MIGRATIONS });
}

// Run directly: `pnpm --filter @cda/api migrate`
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  const handle = createDb(url, { max: 1 });
  await runMigrations(handle.db);
  await handle.close();
}
