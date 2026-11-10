// PostgreSQL connection pool (node-postgres). SERVER ONLY.
// Values are returned in the shapes the app already expects (ISO timestamps, plain numbers, date/time strings).
import "server-only";
import pg from "pg";
import { databaseUrl } from "../env.ts";

const { types } = pg;

/** Text-protocol parsers: keep dates/times as strings, timestamptz as ISO-8601, int8/numeric as numbers. */
export function typeParser(oid: number, format?: "text" | "binary") {
  switch (oid) {
    case 1184: // timestamptz
      return (v: string) => new Date(v).toISOString();
    case 1114: // timestamp
    case 1082: // date
    case 1083: // time
      return (v: string) => v;
    case 20: // int8
    case 1700: // numeric
      return (v: string) => Number(v);
    default:
      return types.getTypeParser(oid, format ?? "text");
  }
}

let pool: pg.Pool | null = null;

export function getPool(): pg.Pool {
  if (pool) return pool;
  const url = databaseUrl();
  if (!url) throw new Error("DATABASE_URL is not set");
  pool = new pg.Pool({
    connectionString: url,
    max: Number(process.env.DATABASE_POOL_MAX ?? 10),
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
    // pg's `types` option takes any object with getTypeParser.
    types: { getTypeParser: typeParser } as unknown as pg.CustomTypesConfig,
  });
  pool.on("error", (err) => console.error("[db] idle client error:", err.message));
  return pool;
}
