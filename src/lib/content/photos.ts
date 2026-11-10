// Studio photos shipped with the site (public/photos). Alt text lives in messages under `photos.<key>`.
export const PHOTOS = {
  "hero-banner": { widths: [845, 1690], w: 1690, h: 574 },
  "hero-dachshund": { widths: [480, 960], w: 1086, h: 1448 },
  "groomer-towel": { widths: [480, 960], w: 1086, h: 1448 },
  "poodle-before-after": { widths: [480, 960], w: 1127, h: 1396 },
  "yorkie-before-after": { widths: [480, 960], w: 1086, h: 1448 },
  "yorkie-bow": { widths: [480, 960], w: 1086, h: 1040 },
  "pomeranian-lap": { widths: [480, 900], w: 900, h: 1348 },
  "pomeranian-towel": { widths: [480, 960], w: 1536, h: 1528 },
} as const;

export type PhotoKey = keyof typeof PHOTOS;

export function photoSrcSet(key: PhotoKey): string {
  return PHOTOS[key].widths.map((w) => `/photos/${key}-${w}.webp ${w}w`).join(", ");
}
export function photoSrc(key: PhotoKey): string {
  const { widths } = PHOTOS[key];
  return `/photos/${key}-${widths[widths.length - 1]}.webp`;
}

/** Bundled studio photos shown in the gallery until the owner uploads their own. */
export const STATIC_GALLERY: readonly PhotoKey[] = [
  "yorkie-bow", "pomeranian-lap", "pomeranian-towel", "hero-dachshund", "poodle-before-after", "yorkie-before-after",
];

export function staticGalleryItems(alt: (key: PhotoKey) => string, keys: readonly PhotoKey[] = STATIC_GALLERY) {
  return keys.map((k) => ({ id: `static-${k}`, src: photoSrc(k), alt: alt(k), caption: "" }));
}
