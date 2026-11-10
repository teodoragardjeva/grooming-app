// Uploaded images live on disk under MEDIA_DIR (a persistent Docker volume) and are served by /media/*. SERVER ONLY.
import "server-only";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { mediaDir } from "./env.ts";

export const MEDIA_TYPES: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

/** Resolves a stored relative path inside MEDIA_DIR; null for anything that would escape it. */
export function resolveMediaPath(rel: string): string | null {
  const root = path.resolve(mediaDir());
  const full = path.resolve(root, rel);
  return full.startsWith(root + path.sep) ? full : null;
}

export async function saveMedia(rel: string, bytes: Uint8Array): Promise<void> {
  const full = resolveMediaPath(rel);
  if (!full) throw new Error("invalid media path");
  await mkdir(path.dirname(full), { recursive: true });
  await writeFile(full, bytes, { flag: "wx" });
}

export async function deleteMedia(rel: string): Promise<void> {
  const full = resolveMediaPath(rel);
  if (full) await rm(full, { force: true });
}

export async function readMedia(rel: string): Promise<{ bytes: Buffer; type: string } | null> {
  const full = resolveMediaPath(rel);
  const type = MEDIA_TYPES[path.extname(rel).slice(1).toLowerCase()];
  if (!full || !type) return null;
  try {
    return { bytes: await readFile(full), type };
  } catch {
    return null;
  }
}
