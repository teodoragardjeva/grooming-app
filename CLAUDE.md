# CLAUDE.md — Magic Paws Grooming Studio (working name: «Магически Лапички»)

Boutique, wizard-school-themed dog grooming studio in Bulgaria: public website + appointment management system.
**The authoritative requirements are in `docs/SPEC.md`. Read it before any feature work.** Where this file and the spec differ, the "Project overrides" below win.

## Project overrides to the spec (decided with the owner)
- **Currency: EUR (€).** The mockup shows "лв." — that is wrong, do not use it. Currency stays a configurable setting (`business_settings.currency`), default `EUR`. Store money as integer minor units (cents).
- **Languages: Bulgarian (default) + English.** Bulgarian at `/`, English at `/en/...` (`next-intl`, locale-prefixed routing with `localePrefix: "as-needed"`, `hreflang` alternates, language switcher in header). Public site, validation messages and emails are bilingual. Admin-editable content (services, promotions, gallery captions, site content, settings) has `_bg` / `_en` fields; English falls back to Bulgarian when empty.
- **Admin dashboard: Bulgarian only.**
- **Design: mixed.** Dark burgundy/gold "enchanted library" hero and footer; light parchment content sections for readability and WCAG AA contrast. See `docs/DESIGN.md`. The PNG in `docs/design/mockup-reference.png` is *inspiration only* — do not copy it pixel-for-pixel.
- **IP safety:** theme is generic "wizard-school magic" (wizard hats, potions, candles, spell books, castle silhouette, paw sparkles). **No Harry Potter trademarks or lookalikes**: no "Hogwarts/Хогвартс", house names, house scarf colors/stripes, lightning scars, owls-with-letters-as-branding, no film/book imagery.
- Do not invent real business details: address, phone, email, reviews are editable placeholders clearly marked as examples (the mockup's address/phone are NOT real).

## Stack
Next.js (App Router) + TypeScript strict · Tailwind CSS + shadcn/ui + Lucide · PostgreSQL 16 (node-postgres) · own admin login (scrypt + server-side sessions) · images on a Docker volume · Docker Compose on DigitalOcean · Resend · React Hook Form + Zod · react-day-picker · date-fns + date-fns-tz · next-intl · Vitest (unit + real-Postgres integration) · Playwright (E2E).

## Commands
**Available today (no npm needed; verified):**
```
bash tests/db/run.sh                                            # 151 real-PostgreSQL checks (needs PG16 server binaries)
node --experimental-strip-types --no-warnings --test tests/unit/*.test.ts   # 26 unit tests
```
Source under `src/lib/{time,availability,security,email}` uses only erasable TypeScript syntax and `.ts` import
suffixes so Node can run it directly; keep that style (or set `allowImportingTsExtensions` in tsconfig).

**Once the Next.js app exists (Phase 1, needs npm):**
```
npm run dev          # local dev server
npm run lint         # ESLint
npm run typecheck    # tsc --noEmit
npm test             # Vitest unit tests
npm run test:db      # SQL tests in a throwaway PostgreSQL container (Docker required); also `npm run test:integration`
npm run test:e2e     # Playwright
npm run build        # production build
```
Before saying a phase is done: lint + typecheck + tests + build must actually have been run and passed. **Never claim tests passed that were not executed.**

## Repository layout (target)
```
src/app/[locale]/(public)/...   public pages (/, services, about, gallery, promotions, contacts, booking, legal/*)
src/app/admin/...               admin UI (Bulgarian only), login at /admin/login
src/app/api/...                 route handlers (booking, confirm, cancel, cron cleanup)
src/lib/availability/           pure availability engine (no I/O) — heavily unit-tested
src/lib/booking/                server-side booking use-cases (call DB RPCs)
src/lib/db/                     pg pool + small query builder (from/select/rpc)
src/lib/admin/session.ts        admin sessions (cookie + admin_sessions table)
src/lib/media.ts                uploaded images on disk (MEDIA_DIR), served at /media/*
src/lib/email/                  Resend client + bilingual templates
src/lib/time/                   Europe/Sofia helpers
src/messages/{bg,en}.json       UI strings
db/migrations/                  SQL migrations (source of truth for schema and booking functions)
db/seed.sql                     default resource + example (clearly fake) content
tests/{unit,db,e2e}/
docs/                           SPEC, DECISIONS, DESIGN, PLAN, SETUP
```

## Non-negotiable invariants
1. **No double booking, ever.** Enforced in PostgreSQL: `appointment_allocations` with `tstzrange` + GiST `EXCLUDE (resource_id WITH =, during WITH &&)`. No volatile predicates (`now()`) in the constraint. Public and admin create/reschedule go through the same DB path (RPC/transaction). The UI disabling a slot is never protection.
2. Intervals are half-open `[start, end)`. Allocation = prep buffer + procedure + cleanup buffer; customers see only the procedure window.
3. Expired pending holds must stop blocking **at request time** (transactional release before conflicting insert); cron is only a backup.
4. All availability/price/duration/buffer computation is **server-side**. Appointments snapshot service name, variant, price, duration, buffers at booking time.
5. Resource-aware everywhere: every allocation/hours/block carries `resource_id`; MVP uses one seeded default resource, no groomer picker in the UI.
6. Timestamps are `timestamptz` (UTC); business logic and display use `Europe/Sofia` (DST-correct).
7. Tokens (confirm/cancel): cryptographically random, only the **hash** stored, time-bounded, single-use where specified, idempotent on repeat clicks.
8. Secrets (`DATABASE_URL`/`POSTGRES_PASSWORD`, `TOKEN_HASH_SECRET`, `RESEND_API_KEY`) never reach the browser or git. Customer data is never exposed in public availability responses. There is no row-level security: the database is reachable only from the app container, public reads select only published/active rows explicitly, and admin authorization checked server-side on every admin page/action.
9. Email failure never rolls back a completed cancellation/confirmation; failed confirmation-request email releases the hold or offers a safe retry without duplicate allocations.
10. Admin may override min-notice and the 24h cancellation rule, **never** overlap/capacity validation.

## Business defaults (admin-configurable settings, not hardcoded)
slot 15 min · min notice 2 h · horizon 30 days · confirmation TTL 10 min · self-cancel until 24 h before · buffers 0 min (global + per-service) · tz Europe/Sofia · currency EUR · payment "Плащане на място в студиото" (no online payments).

## Working agreements (vibe-coding workflow)
- Work **phase by phase** per `docs/PLAN.md`. Before a phase: state dependencies, choices, acceptance criteria. After: run lint/typecheck/tests/build, fix, report honestly what works vs. what needs credentials.
- Small, focused commits; Conventional Commit style (`feat:`, `fix:`, `docs:`, `test:`, `chore:`). Update `docs/PLAN.md` checkboxes and `docs/DECISIONS.md` as decisions are made.
- Prefer simple solutions; document assumptions in `docs/DECISIONS.md` rather than asking about every detail. Ask the owner only about product/brand decisions.
- Write SQL as migrations in `db/migrations/` (never click-ops only); `db/migrate.sh` applies each file once.
- Tests first for the availability engine and booking invariants; DB-level concurrency tests must hit a real Postgres, not mocks.
- UI strings go in `src/messages/{bg,en}.json`; never hardcode user-facing text in components. Bulgarian is written first and must be natural, not machine-sounding.
- Accessibility: labels, keyboard navigation, visible focus, AA contrast, `prefers-reduced-motion` respected for animations.
- Don't commit `.env*` (except `.env.example`), operational customer data, or generated build output.
- External setup the owner must do (DigitalOcean droplet/domain, Resend verified domain, hosting, secrets) is tracked in `docs/SETUP.md`; never fake it with mocks and call it done.
