// Public content reads. Note: there is no row-level security; only published/active rows may be exposed here.
// Every function degrades to an empty value when the database is not configured or unreachable.
import { getDbOrNull, type Db } from "../db/index.ts";
import type { GalleryImage, Promotion, Service, Settings, SiteContentRow } from "./types.ts";

async function safe<T>(label: string, fallback: T, fn: (db: Db) => PromiseLike<T>): Promise<T> {
  const db = getDbOrNull();
  if (!db) return fallback;
  try {
    return await fn(db);
  } catch (err) {
    console.error(`[content] ${label} failed:`, err instanceof Error ? err.message : err);
    return fallback;
  }
}

export function getSettings(): Promise<Settings | null> {
  return safe<Settings | null>("settings", null, async (db) => {
    const { data, error } = await db.from("business_settings").select("*").eq("id", true).maybeSingle();
    if (error) throw error;
    return (data as Settings | null) ?? null;
  });
}

export function getServices(): Promise<Service[]> {
  return safe<Service[]>("services", [], async (db) => {
    const { data, error } = await db
      .from("services")
      .select(
        "id,name_bg,name_en,description_bg,description_en,image_path,booking_enabled,display_order,duration_mode,fixed_duration_minutes,fixed_price_cents,service_variants(id,size_key,label_bg,label_en,duration_minutes,price_cents,display_order,is_active)",
      )
      .eq("is_active", true)
      .order("display_order");
    if (error) throw error;
    type Raw = Omit<Service, "service_variants"> & { service_variants: (Service["service_variants"][number] & { is_active: boolean })[] };
    return ((data ?? []) as Raw[]).map((s) => ({
      ...s,
      service_variants: s.service_variants
        .filter((v) => v.is_active)
        .sort((a, b) => a.display_order - b.display_order),
    }));
  });
}

export function getGallery(limit?: number): Promise<GalleryImage[]> {
  return safe<GalleryImage[]>("gallery", [], async (db) => {
    let q = db
      .from("gallery_images")
      .select("id,storage_path,caption_bg,caption_en,alt_bg,alt_en,category,display_order")
      .eq("is_published", true)
      .order("display_order")
      .order("created_at", { ascending: false });
    if (limit) q = q.limit(limit);
    const { data, error } = await q;
    if (error) throw error;
    return (data ?? []) as GalleryImage[];
  });
}

export function getPromotions(): Promise<Promotion[]> {
  return safe<Promotion[]>("promotions", [], async (db) => {
    const { data, error } = await db
      .from("promotions")
      .select("id,title_bg,title_en,description_bg,description_en,image_path,starts_at,ends_at,service_ids")
      .eq("is_published", true)
      .order("display_order");
    if (error) throw error;
    const now = Date.now();
    return ((data ?? []) as Promotion[]).filter(
      (p) => (!p.starts_at || new Date(p.starts_at).getTime() <= now) && (!p.ends_at || new Date(p.ends_at).getTime() > now),
    );
  });
}

export function getSiteContent(keys: string[]): Promise<Record<string, SiteContentRow>> {
  return safe<Record<string, SiteContentRow>>("site_content", {}, async (db) => {
    const { data, error } = await db.from("site_content").select("key,content_bg,content_en").in("key", keys);
    if (error) throw error;
    return Object.fromEntries(((data ?? []) as SiteContentRow[]).map((r) => [r.key, r]));
  });
}

/** Latest edit times per content area (for sitemap lastmod). Missing values are simply omitted. */
export function getLastModified(): Promise<{ services?: Date; content?: Date; settings?: Date }> {
  return safe<{ services?: Date; content?: Date; settings?: Date }>("lastmod", {}, async (db) => {
    const latest = async (table: string) => {
      const { data } = await db.from(table).select("updated_at").order("updated_at", { ascending: false }).limit(1).maybeSingle();
      const v = (data as { updated_at?: string } | null)?.updated_at;
      return v ? new Date(v) : undefined;
    };
    const [services, content, settings] = await Promise.all([latest("services"), latest("site_content"), latest("business_settings")]);
    return { services, content, settings };
  });
}
