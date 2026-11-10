"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin/auth";
import { back } from "@/lib/admin/flash";
import { cents, int, str } from "@/lib/admin/parse";
import { S } from "@/lib/admin/strings";

const HERE = "/admin/services";
const SIZES = ["small", "medium", "large", "xlarge"] as const;

export async function saveServiceAction(fd: FormData) {
  const { db } = await requireAdmin();
  const id = str(fd, "id");
  const mode = str(fd, "mode") === "size_based" ? "size_based" : "fixed";
  const name = str(fd, "name_bg");
  const duration = int(fd, "duration"), price = cents(fd, "price");
  const prep = int(fd, "prep"), cleanup = int(fd, "cleanup"), order = int(fd, "order") ?? 0;
  const bad = (n: number | null) => n !== null && Number.isNaN(n);
  if (!name || bad(duration) || bad(price) || bad(prep) || bad(cleanup) || (prep ?? 0) < 0 || (cleanup ?? 0) < 0) back(HERE, "err", S.services.invalid);
  if (mode === "fixed" && (!duration || duration <= 0 || price == null)) back(HERE, "err", S.services.invalid);

  const row = {
    name_bg: name, name_en: str(fd, "name_en"), description_bg: str(fd, "description_bg"), description_en: str(fd, "description_en"),
    duration_mode: mode, fixed_duration_minutes: mode === "fixed" ? duration : null, fixed_price_cents: mode === "fixed" ? price : null,
    prep_buffer_minutes: prep, cleanup_buffer_minutes: cleanup, booking_enabled: fd.get("booking") === "on", is_active: true,
    display_order: order ?? 0, updated_at: new Date().toISOString(),
  };
  // Switching mode must satisfy the DB check constraint, so clear the other mode's columns in the same statement.
  const saved = id
    ? await db.from("services").update(row).eq("id", id).select("id").single()
    : await db.from("services").insert(row).select("id").single();
  if (saved.error || !saved.data) back(HERE, "err", S.services.invalid);
  const serviceId = saved.data.id as string;

  if (mode === "size_based") {
    for (const [i, size] of SIZES.entries()) {
      const label = str(fd, `v_${size}_label`), d = int(fd, `v_${size}_duration`), p = cents(fd, `v_${size}_price`);
      if (!label && d == null && p == null) {
        await db.from("service_variants").delete().eq("service_id", serviceId).eq("size_key", size);
        continue;
      }
      if (!label || !d || d <= 0 || p == null || Number.isNaN(p)) back(HERE, "err", S.services.invalid);
      const { error } = await db.from("service_variants").upsert(
        { service_id: serviceId, size_key: size, label_bg: label, label_en: str(fd, `v_${size}_label_en`), duration_minutes: d, price_cents: p, display_order: i, is_active: true },
        { onConflict: "service_id,size_key" },
      );
      if (error) back(HERE, "err", S.services.invalid);
    }
  } else {
    await db.from("service_variants").delete().eq("service_id", serviceId);
  }
  revalidatePath("/", "layout");
  back(HERE, "ok", S.services.saved);
}

export async function deleteServiceAction(fd: FormData) {
  const { db } = await requireAdmin();
  if (fd.get("confirm") !== "yes") back(HERE, "err", S.common.error);
  await db.from("services").delete().eq("id", String(fd.get("id")));
  revalidatePath("/", "layout");
  back(HERE, "ok", S.services.deleted);
}
