import { PHOTOS, photoSrc, photoSrcSet, type PhotoKey } from "@/lib/content/photos";

/** Responsive studio photo (WebP, srcset). `alt` comes from messages so it is bilingual. */
export function Photo({ name, alt, sizes, className, priority = false }: { name: PhotoKey; alt: string; sizes: string; className?: string; priority?: boolean }) {
  const { w, h } = PHOTOS[name];
  return (
    // eslint-disable-next-line @next/next/no-img-element -- pre-sized static WebP with explicit srcset
    <img
      src={photoSrc(name)}
      srcSet={photoSrcSet(name)}
      sizes={sizes}
      width={w}
      height={h}
      alt={alt}
      loading={priority ? "eager" : "lazy"}
      fetchPriority={priority ? "high" : undefined}
      decoding="async"
      className={className}
    />
  );
}
