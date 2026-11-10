"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin/auth";
import { back } from "@/lib/admin/flash";
import { str } from "@/lib/admin/parse";
import { S } from "@/lib/admin/strings";

const CONTENT_KEYS = ["home.hero_title", "home.hero_subtitle", "about.body", "contacts.hours", "legal.privacy", "legal.terms", "legal.cookies"] as const;

export async function saveContentAction(fd: FormData) {
  const { db } = await requireAdmin();
  const key = String(fd.get("key"));
  if (!(CONTENT_KEYS as readonly string[]).includes(key)) back("/admin/content", "err", S.common.error);
  const bg = str(fd, "bg"), en = str(fd, "en");
  const { error } = bg == null && en == null
    ? await db.from("site_content").delete().eq("key", key)
    : await db.from("site_content").upsert({ key, content_bg: bg, content_en: en, updated_at: new Date().toISOString() });
  if (error) back("/admin/content", "err", S.common.error);
  revalidatePath("/", "layout");
  back("/admin/content", "ok", S.content.saved);
}
