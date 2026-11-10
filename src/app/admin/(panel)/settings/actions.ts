"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin/auth";
import { back } from "@/lib/admin/flash";
import { int, str } from "@/lib/admin/parse";
import { S } from "@/lib/admin/strings";

export async function saveSettingsAction(fd: FormData) {
  const { db } = await requireAdmin();
  const HERE = "/admin/settings";
  const n = (k: string, min: number, max: number) => {
    const v = int(fd, k);
    if (v == null || Number.isNaN(v) || v < min || v > max) back(HERE, "err", S.settings.invalid);
    return v;
  };
  const currency = (str(fd, "currency") ?? "EUR").toUpperCase();
  const map = str(fd, "map_url");
  const email = str(fd, "email");
  if (!/^[A-Z]{3}$/.test(currency) || (map && !/^https:\/\//.test(map)) || (email && !/^\S+@\S+\.\S+$/.test(email))) back(HERE, "err", S.settings.invalid);
  const { error } = await db.from("business_settings").update({
    studio_name_bg: str(fd, "studio_name_bg") ?? "", studio_name_en: str(fd, "studio_name_en") ?? "",
    phone: str(fd, "phone"), email, address_bg: str(fd, "address_bg"), address_en: str(fd, "address_en"), map_url: map,
    seo_description_bg: str(fd, "seo_description_bg"), seo_description_en: str(fd, "seo_description_en"),
    slot_minutes: n("slot", 5, 120), min_notice_minutes: n("minNotice", 0, 100000), horizon_days: n("horizon", 1, 365),
    confirmation_ttl_minutes: n("ttl", 1, 120), cancel_cutoff_hours: n("cutoff", 0, 1000),
    default_prep_buffer_minutes: n("prep", 0, 240), default_cleanup_buffer_minutes: n("cleanup", 0, 240),
    currency, is_example_data: fd.get("real") !== "on", updated_at: new Date().toISOString(),
  }).eq("id", true);
  if (error) back(HERE, "err", S.settings.invalid);
  revalidatePath("/", "layout");
  back(HERE, "ok", S.settings.saved);
}
