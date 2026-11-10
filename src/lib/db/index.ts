// Shared database access. SERVER ONLY.
import "server-only";
import { databaseUrl } from "../env.ts";
import { createDb, type Db } from "./client.ts";
import { getPool } from "./pool.ts";

export type { Db, Rpc } from "./client.ts";

let cached: Db | null = null;

/** The application database. Throws when DATABASE_URL is missing. */
export function getDb(): Db {
  cached ??= createDb(getPool());
  return cached;
}

/** Like getDb() but returns null when the database is not configured (public pages degrade gracefully). */
export function getDbOrNull(): Db | null {
  return databaseUrl() ? getDb() : null;
}
