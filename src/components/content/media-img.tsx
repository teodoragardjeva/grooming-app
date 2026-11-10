/* eslint-disable @next/next/no-img-element -- admin-uploaded Storage images; sizing is handled via CSS */
export function MediaImg({ src, alt, className }: { src: string; alt: string; className?: string }) {
  return <img src={src} alt={alt} loading="lazy" decoding="async" className={className} />;
}
