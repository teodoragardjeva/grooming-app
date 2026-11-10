# Design direction

Reference: `docs/design/mockup-reference.png` (inspiration only; do not reproduce 1:1).

## Concept
"Magic school for dogs": a warm, premium boutique. The first screen and footer are an enchanted dark-burgundy library (candles, potion bottles, spell books, castle silhouette, gold sparkles). Everything the visitor must read or act on (services, prices, booking, forms) sits on light parchment for contrast and calm.

## What to keep from the mockup
Hero with a wizard-hatted dog and a prominent gold "Запази час" button · parchment service cards with price chips · gallery strip · promo banner · 4 benefit icons · burgundy footer with contacts/hours/socials.

## What to change
- Prices in **€** (not лв.).
- Remove anything Harry-Potter-specific: street name "Хогвартска", house-scarf stripes on the corgi, copying of film styling. Use original wizard-school motifs.
- Less ornament density in content areas; more whitespace; one clear CTA per section.
- Add a visible **BG | EN** language switcher in the header.
- Accessible contrast (AA), larger tap targets, visible focus rings, `prefers-reduced-motion` for sparkles/animations.
- Real booking flow (stepper), not just a button.
- Placeholder contact info clearly marked as example in admin; never shown as real facts in production until the owner edits it.

## Tokens (starting point; refine in Phase 1)
| Token | Value | Use |
|---|---|---|
| `burgundy-900` | `#3B0D1E` | hero/footer background |
| `burgundy-700` | `#6B1D36` | buttons, headings on light |
| `gold-400` | `#D9B26A` | accents, CTA fill, borders |
| `gold-600` | `#A87B2E` | gold text on light (check AA) |
| `parchment-50` | `#FBF6EA` | page background |
| `parchment-100` | `#F3E8CF` | cards |
| `ink-900` | `#2A1A1F` | body text |
| `plum-500` | `#4B3A78` | secondary accent (night-sky) |

Fonts (Cyrillic support required): headings a classical serif with Cyrillic (e.g. Cormorant Garamond / Playfair Display via `next/font`), body a clean sans with Cyrillic (e.g. Inter / Nunito). Verify Cyrillic glyph coverage.

## Components to build (shadcn/ui based, themed)
Header + language switcher · gold CTA button · parchment card · price chip · service card · gallery grid + lightbox · promo banner · benefits row · footer · booking stepper · slot picker · empty/loading/success/error states.

## Imagery
Hero/gallery photos are placeholders until the owner supplies real photography. Optimize with `next/image`; store uploads on the Docker media volume (`MEDIA_DIR`).

## Update (owner feedback, Nov 2026)
Restyled closer to the mockup: textured warm parchment page, deep wine gradient header/hero/footer, gold-foil buttons, shield-paw logo, price tags on service cards, burgundy promo cards, booking band + gallery strip, benefits row, 4-column footer. Headings use Playfair Display (Cormorant's Cyrillic letterforms were hard to read). Still no Harry-Potter elements (no scarf-stripe corgi, no "Хогвартска").
