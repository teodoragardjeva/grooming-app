export type Locale = "bg" | "en";

export interface Settings {
  default_resource_id: string | null;
  currency: string;
  slot_minutes: number;
  min_notice_minutes: number;
  horizon_days: number;
  confirmation_ttl_minutes: number;
  cancel_cutoff_hours: number;
  studio_name_bg: string;
  studio_name_en: string;
  phone: string | null;
  email: string | null;
  address_bg: string | null;
  address_en: string | null;
  map_url: string | null;
  socials: Record<string, string>;
  logo_path: string | null;
  seo_description_bg: string | null;
  seo_description_en: string | null;
  is_example_data: boolean;
}

export interface Variant {
  id: string;
  size_key: "small" | "medium" | "large" | "xlarge";
  label_bg: string;
  label_en: string | null;
  duration_minutes: number;
  price_cents: number;
  display_order: number;
}

export interface Service {
  id: string;
  name_bg: string;
  name_en: string | null;
  description_bg: string | null;
  description_en: string | null;
  image_path: string | null;
  booking_enabled: boolean;
  display_order: number;
  duration_mode: "fixed" | "size_based";
  fixed_duration_minutes: number | null;
  fixed_price_cents: number | null;
  service_variants: Variant[];
}

export interface GalleryImage {
  id: string;
  storage_path: string;
  caption_bg: string | null;
  caption_en: string | null;
  alt_bg: string | null;
  alt_en: string | null;
  category: string | null;
  display_order: number;
}

export interface Promotion {
  id: string;
  title_bg: string;
  title_en: string | null;
  description_bg: string | null;
  description_en: string | null;
  image_path: string | null;
  starts_at: string | null;
  ends_at: string | null;
  service_ids: string[];
}

export interface SiteContentRow {
  key: string;
  content_bg: string | null;
  content_en: string | null;
}
