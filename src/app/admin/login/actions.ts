"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { signIn, signOut } from "@/lib/admin/session";
import { getDb } from "@/lib/db";
import { databaseUrl } from "@/lib/env";
import { allowRequest, clientIp } from "@/lib/security/rate-limit";

const schema = z.object({ email: z.email(), password: z.string().min(1).max(200) });

export async function loginAction(formData: FormData) {
  if (!databaseUrl()) redirect("/admin/login?e=config");
  const parsed = schema.safeParse({ email: formData.get("email"), password: formData.get("password") });
  if (!parsed.success) redirect("/admin/login?e=invalid");

  // Brute-force throttle: 8 attempts / 15 min per IP (DB-backed).
  try {
    const h = await headers();
    if (!(await allowRequest(getDb().rpc, "admin-login", clientIp(h), 8, 900))) redirect("/admin/login?e=rate");
  } catch (err) {
    if (err && typeof err === "object" && "digest" in err) throw err; // Next redirect
    console.warn("[admin-login] rate limit unavailable:", err instanceof Error ? err.message : err);
  }

  if (!(await signIn(parsed.data.email, parsed.data.password))) redirect("/admin/login?e=invalid");

  // Data retention: drop appointments (and their customer data) older than one month. Never blocks sign-in.
  try {
    await getDb().rpc("purge_old_appointments");
  } catch (err) {
    console.warn("[admin-login] purge skipped:", err instanceof Error ? err.message : err);
  }
  redirect("/admin");
}

export async function logoutAction() {
  if (databaseUrl()) await signOut();
  redirect("/admin/login");
}
