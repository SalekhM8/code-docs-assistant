import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

export type Db = PostgresJsDatabase<typeof schema>;

export interface DbHandle {
  db: Db;
  close: () => Promise<void>;
}

export function createDb(url: string, options: { max?: number } = {}): DbHandle {
  const sql = postgres(url, { max: options.max ?? 10, onnotice: () => undefined });
  return { db: drizzle(sql, { schema }), close: () => sql.end({ timeout: 5 }) };
}
