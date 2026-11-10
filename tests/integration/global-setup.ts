// Builds a fresh `app` database (migrations + seed + test helpers) on the throwaway test PostgreSQL
// (docker-compose.test.yml, 127.0.0.1:54329) before the integration tests run.
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import pg from "pg";

const ROOT = path.resolve(import.meta.dirname, "../..");
const ADMIN_URL = process.env.TEST_ADMIN_URL ?? "postgres://postgres@127.0.0.1:54329/postgres";
const APP_URL = process.env.TEST_DATABASE_URL ?? "postgres://postgres@127.0.0.1:54329/app";

export default async function setup() {
  process.env.TEST_DATABASE_URL = APP_URL;

  const admin = new pg.Client({ connectionString: ADMIN_URL });
  await admin.connect();
  await admin.query("drop database if exists app with (force)");
  await admin.query("create database app");
  await admin.end();

  const app = new pg.Client({ connectionString: APP_URL });
  await app.connect();
  const dir = path.join(ROOT, "db/migrations");
  for (const f of readdirSync(dir).filter((n) => n.endsWith(".sql")).sort()) {
    await app.query(readFileSync(path.join(dir, f), "utf8"));
  }
  await app.query(readFileSync(path.join(ROOT, "db/seed.sql"), "utf8"));
  await app.end();
}
