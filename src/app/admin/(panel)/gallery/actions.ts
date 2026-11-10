"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin/auth";
import { back } from "@/lib/admin/flash";
import { detectImage, MAX_IMAGE_BYTES } from "@/lib/admin/image-type";
import { int, str } from "@/lib/admin/parse";
import { S } from "@/lib/admin/strings";
import { deleteMedia, saveMedia } from "@/lib/media";

const HERE = "/admin/gallery";

export async function uploadImageAction(fd: FormData) {
  const { db } = await requireAdmin();
  const file = fd.get("file");
  if (!(file instanceof File) || file.size === 0 || file.size > MAX_IMAGE_BYTES) back(HERE, "err", S.gallery.badFile);
  const bytes = new Uint8Array(await file.arrayBuffer());
  const kind = detectImage(bytes);
  if (!kind) back(HERE, "err", S.gallery.badFile);
  const path = `gallery/${randomUUID()}.${kind.ext}`;
  try {
    await saveMedia(path, bytes);
  } catch (err) {
    console.error("[gallery] saving image failed:", err instanceof Error ? err.message : err);
    back(HERE, "err", S.gallery.storage);
  }
  const { error } = await db.from("gallery_images").insert({
    storage_path: path, caption_bg: str(fd, "caption_bg"), caption_en: str(fd, "caption_en"), alt_bg: str(fd, "alt_bg"), alt_en: str(fd, "alt_en"),
    category: str(fd, "category"), display_order: int(fd, "order") ?? 0, is_published: true,
  });
  if (error) { await deleteMedia(path); back(HERE, "err", S.common.error); }
  revalidatePath("/", "layout");
  back(HERE, "ok", S.gallery.uploaded);
}

export async function updateImageAction(fd: FormData) {
  const { db } = await requireAdmin();
  const { error } = await db.from("gallery_images").update({
    caption_bg: str(fd, "caption_bg"), caption_en: str(fd, "caption_en"), alt_bg: str(fd, "alt_bg"), alt_en: str(fd, "alt_en"),
    category: str(fd, "category"), display_order: int(fd, "order") ?? 0, is_published: fd.get("published") === "on",
  }).eq("id", String(fd.get("id")));
  revalidatePath("/", "layout");
  back(HERE, error ? "err" : "ok", error ? S.common.error : S.common.saved);
}

export async function deleteImageAction(fd: FormData) {
  const { db } = await requireAdmin();
  if (fd.get("confirm") !== "yes") back(HERE, "err", S.common.error);
  const id = String(fd.get("id"));
  const { data } = await db.from("gallery_images").select("storage_path").eq("id", id).maybeSingle();
  await db.from("gallery_images").delete().eq("id", id);
  if (data?.storage_path) await deleteMedia(data.storage_path as string);
  revalidatePath("/", "layout");
  back(HERE, "ok", S.common.saved);
}
