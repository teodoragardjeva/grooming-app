// Server-side admin authorization. Called by every admin layout/page/action; the UI is never the guard.
import "server-only";
import { redirect } from "next/navigation";
import { databaseUrl } from "../env.ts";
import { getDb, type Db } from "../db/index.ts";
import { currentAdmin } from "./session.ts";

export interface AdminContext {
  userId: string;
  email: string | null;
  db: Db;
}

export async function requireAdmin(): Promise<AdminContext> {
  if (!databaseUrl()) redirect("/admin/login?e=config");
  const admin = await currentAdmin();
  if (!admin) redirect("/admin/login");
  return { userId: admin.userId, email: admin.email, db: getDb() };
}
