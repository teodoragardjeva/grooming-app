// Admin sessions: random token in an httpOnly cookie, SHA-256 hash stored in public.admin_sessions. SERVER ONLY.
import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { getDb } from "../db/index.ts";
import { siteUrl } from "../env.ts";
import { dummyVerify, verifyPassword } from "../security/password.ts";

export const SESSION_COOKIE = "admin_session";
const SESSION_DAYS = 7;

const hashToken = (token: string): string => createHash("sha256").update(token).digest("hex");

/** Verifies credentials and opens a session. Returns false for any failure (no detail leaked). */
export async function signIn(email: string, password: string): Promise<boolean> {
  const db = getDb();
  const { data: user } = await db
    .from("admin_profiles")
    .select("user_id,email,password_hash")
    .eq("email", email.trim().toLowerCase()) // admin emails are stored lowercase (scripts/create-admin.mjs)
    .maybeSingle();
  if (!user) {
    await dummyVerify(password);
    return false;
  }
  if (!(await verifyPassword(password, user.password_hash as string))) return false;

  const token = randomBytes(32).toString("base64url");
  const expires = new Date(Date.now() + SESSION_DAYS * 86_400_000);
  const { error } = await db.from("admin_sessions").insert({ token_hash: hashToken(token), user_id: user.user_id, expires_at: expires.toISOString() });
  if (error) throw new Error(`session insert failed: ${error.message}`);
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: siteUrl().startsWith("https://"),
    path: "/admin",
    expires,
  });
  return true;
}

export async function signOut(): Promise<void> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) await getDb().from("admin_sessions").delete().eq("token_hash", hashToken(token));
  store.delete({ name: SESSION_COOKIE, path: "/admin" });
}

/** The signed-in admin for the current request, or null. */
export async function currentAdmin(): Promise<{ userId: string; email: string } | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const db = getDb();
  const { data: session } = await db.from("admin_sessions").select("user_id,expires_at").eq("token_hash", hashToken(token)).maybeSingle();
  if (!session || new Date(session.expires_at as string) <= new Date()) return null;
  const { data: user } = await db.from("admin_profiles").select("user_id,email").eq("user_id", session.user_id).maybeSingle();
  return user ? { userId: user.user_id as string, email: user.email as string } : null;
}
