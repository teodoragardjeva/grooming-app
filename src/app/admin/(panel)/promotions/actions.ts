"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin/auth";
import { back } from "@/lib/admin/flash";
import { int, str } from "@/lib/admin/parse";
import { S } from "@/lib/admin/strings";
import { localDateTimeToUtc } from "@/lib/time/zone";

const HERE = "/admin/promotions";
const day = (v: string | null, end: boolean) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? localDateTimeToUtc(v, end ? "23:59" : "00:00").toISOString() : null);

export async function savePromotionAction(fd: FormData) {
  const { db } = await requireAdmin();
  const id = str(fd, "id"), title = str(fd, "title_bg");
  const starts = day(str(fd, "starts"), false), ends = day(str(fd, "ends"), true);
  if (!title || (starts && ends && ends <= starts)) back(HERE, "err", S.promos.invalid);
  const row = {
    title_bg: title, title_en: str(fd, "title_en"), description_bg: str(fd, "description_bg"), description_en: str(fd, "description_en"),
    starts_at: starts, ends_at: ends, is_published: fd.get("published") === "on", display_order: int(fd, "order") ?? 0,
  };
  const { error } = id ? await db.from("promotions").update(row).eq("id", id) : await db.from("promotions").insert(row);
  if (error) back(HERE, "err", S.promos.invalid);
  revalidatePath("/", "layout");
  back(HERE, "ok", S.promos.saved);
}

export async function deletePromotionAction(fd: FormData) {
  const { db } = await requireAdmin();
  if (fd.get("confirm") !== "yes") back(HERE, "err", S.common.error);
  await db.from("promotions").delete().eq("id", String(fd.get("id")));
  revalidatePath("/", "layout");
  back(HERE, "ok", S.promos.deleted);
}
