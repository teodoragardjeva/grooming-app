# Decisions log

Newest at the bottom. Format: date · decision · reason.

| Date | Decision | Reason |
|---|---|---|
| 2026-11-07 | Currency is **EUR (€)**, configurable in settings; money stored as integer cents. | Owner decision; mockup's "лв." is wrong. |
| 2026-11-07 | Languages: Bulgarian default at `/`, English at `/en`, via `next-intl`; content fields `_bg`/`_en`, English falls back to Bulgarian. | Owner decision; best SEO (hreflang) and shareable links. |
| 2026-11-07 | Admin UI is Bulgarian only. | Owner decision; less translation surface. |
| 2026-11-07 | Visual direction: dark burgundy/gold hero + footer, light parchment content sections. Mockup is inspiration only. | Owner decision; balances theme with readability/accessibility. |
| 2026-11-07 | Theme is generic wizard-school magic; no Harry Potter trademarks or lookalike branding. Working brand name "Магически Лапички" kept as an editable placeholder. | Avoid IP/trademark risk for a commercial business. |
| 2026-11-07 | Address, phone, email, hours, reviews and prices from the mockup are placeholders, not real data. | Spec: do not invent real business details. |
| 2026-11-07 | Work proceeds scaffold → Phase 1 → owner review, then phase by phase. | Owner decision. |
| 2026-11-07 | Booking logic lives in PostgreSQL functions (`create_appointment`, `confirm_booking`, `cancel_by_token`, `admin_*`), called only by Next.js server code, which validates input / the admin session first. | One shared overlap invariant for public and admin paths. |
| 2026-11-07 | Allocation rows exist only while time is occupied; expired/cancelled allocations are deleted. Exclusion constraint has no `now()` predicate; `release_expired_holds()` runs inside every booking call. | Spec §8: expiry must not depend on cron. |
| 2026-11-07 | 24h self-cancel deadline is measured on the studio wall clock (Friday 15:00 -> Thursday 15:00 local), so across a DST change it can differ from 24 elapsed hours by 1h. | Matches the spec's example. |
| 2026-11-07 | Booking horizon is `horizon_days * 24` hours (exact), not calendar-day arithmetic. | Avoid session-time-zone dependent interval math. |
| 2026-11-07 | Overrides: if any override row exists for a date, weekly hours are ignored for it (closed row = closed day; other rows = special hours). | Simple, predictable holiday/special-hours model. |
| 2026-11-07 | Slot grid is anchored at each window's opening time, in `slot_minutes` steps. | Works with split shifts and odd opening times. |
| 2026-11-07 | npm registry was unreachable in the first build environment, so DB, engine, tokens and email templates were built first without it. | Honest status; resolved on 2026-11-07 when npm access was enabled. |
| 2026-11-07 | Phase 1 stack versions: Next.js 16 (uses `src/proxy.ts`, the renamed middleware), React 19, Tailwind CSS 4, next-intl 4, Vitest 5, TypeScript 5 (strict + `erasableSyntaxOnly` + `allowImportingTsExtensions` so the Node-runnable `src/lib` files stay valid). | Current releases; `erasableSyntaxOnly` enforces the CLAUDE.md "Node can run it directly" style. |
| 2026-11-07 | Fonts: Cormorant Garamond (headings) and Nunito (body) via `@fontsource-variable/*` npm packages, not `next/font/google`. Both include Cyrillic. | The build environment can only reach npm/GitHub, and self-hosting avoids a runtime Google request (privacy/GDPR). |
| 2026-11-07 | `npm test` runs the existing `node:test` files (`test:node`) and then Vitest; Vitest only collects `*.spec.ts` (`tests/vitest`, `src/**`). | The Node tests use `node:test`, which Vitest cannot run; this keeps one `npm test` entry point without duplication. |
| 2026-11-07 | Locale auto-detection from `Accept-Language` is OFF (`localeDetection: false`). `/` is always Bulgarian; visitors switch with the BG \| EN switcher. | Predictable shareable URLs and SEO; matches "Bulgarian at `/`". Easy to enable later if the owner wants English browsers redirected. |
| 2026-11-07 | Brand name in English messages is "Magic Paws" (working name), Bulgarian "Магически Лапички". Both are placeholders. | Owner to confirm final brand; see open items. |
| 2026-11-07 | Footer contacts/hours are visibly labelled "Example data" placeholders, and Phase 1 pages show no fake prices, services, reviews or photos. | CLAUDE.md: never present invented business details as real. |
| 2026-11-07 | Known Next.js 16 behaviour: for 404s the server returns the correct 404 status but the HTML body is a client-rendered shell (`__next_error__`); a real browser renders the full localized 404 (verified in headless Chrome for `/nope` and `/en/nope`). Invalid `[locale]` values such as `/favicon.ico` return 404, not 200/500. | Verified by experiment; revisit if a future Next version changes it. SEO impact is nil because the status code is 404. |
| 2026-11-07 | `agentRules: false` in `next.config.ts`. | Stops `next dev` from auto-generating an `AGENTS.md`; the project already has `CLAUDE.md`. |
| 2026-11-07 | Brand confirmed by owner: «Магически Лапички» / "Magic Paws". | Owner decision. |
| 2026-11-07 | Use-cases take injected deps (`rpc`, `mailer`, `now`); production uses the `pg` pool (`src/lib/db`) + Resend, tests use a plain `pg` adapter against real PostgreSQL. | Exercises the real SQL and the same code paths as production. |
| 2026-11-07 | Browsers never talk to the database: only server code does, through one connection pool. Admin pages/actions call `requireAdmin()` first; public reads select only published/active rows explicitly. | The database is not exposed; authorization is in one server-side place. |
| 2026-11-07 | Confirm/cancel emails link to a page that shows a summary on GET and changes state only on an explicit POST button. | Mail scanners prefetch links; GET must be safe/idempotent. |
| 2026-11-07 | Rate limits (DB-backed, per IP/email): booking 5/10 min/IP + 3/10 min/email, confirm/cancel 20/10 min, availability 120/min, admin login 8/15 min. Honeypot always on; Turnstile optional (env). | Serverless-safe throttling without extra infrastructure. |
| 2026-11-07 | Admin is server-rendered forms + server actions (no client state), Bulgarian strings in `src/lib/admin/strings.ts`. Calendar is read-only timeline with click-to-create; reschedule via form (no drag-and-drop). | Simple, accessible, testable; DnD can be added later. |
| 2026-11-07 | Schedule changes that would strand existing appointments return the affected list and require explicit confirmation; appointments are never auto-cancelled. | Spec/owner rule. |
| 2026-11-07 | Gallery uploads validate size and magic bytes (JPEG/PNG/WebP) server-side; files are served only for jpg/png/webp extensions. SVG is not allowed. | Prevents script-bearing uploads. |
| 2026-11-07 | Legal pages show clearly-marked DRAFT text until the owner replaces it in Admin → Текстове. | Owner/lawyer must review legal text. |
| 2026-11-07 | Cleanup endpoint (`/api/cron/cleanup`) is meant to run daily from an external scheduler; correctness never depends on it. | Request-time hold release is the real mechanism. |
| 2026-11-07 | Email provider is Resend; `RESEND_API_KEY` and `RESEND_FROM` are set manually. | Owner decision; code already reads `RESEND_API_KEY`, so no code change. |
| 2026-11-10 | Stack: PostgreSQL 16 in Docker Compose, Next.js standalone image, deployed to a DigitalOcean droplet (HTTPS originally via Caddy; superseded 2026-11-12). | Owner decision; fresh start on the new deployment and database. |
| 2026-11-10 | No row-level security and no per-request database roles: the app connects with one database user and the database is not published. Tables for admin accounts (`admin_profiles`: scrypt hash) and server-side sessions (`admin_sessions`: SHA-256 of a random cookie token, 7 days) handle admin sign-in. | Plain PostgreSQL has no API layer in front of it; authorization is enforced in server code. |
| 2026-11-10 | `src/lib/db/client.ts` is a small query builder with the `from().select().eq()`/`rpc()` call shape, so the existing pages and actions kept their code. All identifiers are validated, all values are bound parameters. | Smallest safe migration of ~50 call sites; covered by `tests/vitest/db-client.spec.ts`. |
| 2026-11-10 | Uploaded images are stored on a Docker volume (`MEDIA_DIR`, default `/data/media`) and served by `/media/*` (immutable cache, extension allow-list, path-traversal guard). The volume must be backed up. | Owner decision; no extra paid service. Move to DO Spaces later if needed. |
| 2026-11-10 | Migrations are applied by `db/migrate.sh` (plain `psql`, each file once, tracked in `public.schema_migrations`) in a one-off compose service. The old RLS/privilege migrations were removed because the project starts fresh on the new database. | No migration tool dependency; clean start. |
| 2026-11-10 | The daily `/api/cron/cleanup` call is made by a small `cron` compose service. | Same behaviour, no platform dependency. |
| 2026-11-12 | Caddy removed; HTTPS and the domain (magic-paws.robodigit.win) are handled by the Nginx Proxy Manager already running on the server. The `app` service joins the external network `nginx-proxy-manager_default` (as `proxy`) in addition to the default network, and NPM forwards to `app:3000`. | NPM already owns ports 80/443, so Caddy would conflict and duplicate TLS handling. If NPM is recreated under another stack name, update the network name in `docker-compose.yml`. |
| 2026-11-12 | The `migrate` service is built from `Dockerfile.migrate` (db/ copied into the image) instead of bind-mounting `./db`. | Portainer Git deployments run compose from inside a container, so relative bind mounts can point at the wrong host path; baking the files in makes the stack self-contained. |

## Open items for the owner
- Final brand name, logo, real photos (the mockup dog images are AI-generated illustrations; real photography preferred for production).
- Real contact details, working hours, services and prices.
- DigitalOcean droplet + domain, Resend account with verified domain (see `SETUP.md`).
- Legal texts (privacy, terms, cookies) need owner/lawyer review.

## One pending reservation per e-mail; retention purge
- Public bookings: at most one `pending_confirmation` appointment per e-mail (case-insensitive). Enforced in `create_appointment` (advisory lock per e-mail) and by the partial unique index `appointments_one_pending_per_email`. Error code `pending_exists`. Expired holds are released first, so an expired hold never blocks. Admin-created (confirmed) bookings are not affected.
- Retention: `purge_old_appointments()` deletes appointments whose start is older than 1 month, plus their notification logs, audit-log rows and orphaned customer records. It runs when an admin signs in (failure never blocks sign-in). Not on the cron by default; add it to `housekeeping()` if purging should not depend on admin logins.
- UI feedback: `Button` has a `loading` prop; `SubmitButton` (useFormStatus) is used for all admin server-action forms; admin result banner is sticky and scrolls into view.

## Buffers only count between procedures
Working-hours validation applies to the customer-visible procedure window `[start, end)`. Prep/cleanup buffers may extend before opening or after closing time. They still may not overlap another allocation (exclusion constraint) and still may not run into a block/holiday/vacation (`check_booking`). Changing the weekly hours warns about appointments whose procedure (not allocation) falls outside the new hours.

## SEO / AI visibility
- Icons (`src/app/icon.png`, `apple-icon.png`, `favicon.ico`) and share images (`public/og-bg.png`, `og-en.png`) are original artwork (gold shield + paw on burgundy), generated once; replace with the owner's final logo files when available.
- Structured data: WebSite + Organization (home), LocalBusiness (home, only when contact data is not example data), BreadcrumbList (sub pages), ItemList of Service/Offer with prices (services), FAQPage (services, visible FAQ text must match the markup).
- FAQ answers contain only facts that already hold in the product: booking flow, hold minutes and cancel cutoff (from settings), payment on site. Owner should review the wording in `src/messages/*.json` ("faq").
- `llms.txt` (bg+en summary + service prices) and sitemap `lastmod` (from `updated_at` of services / site_content / business_settings; omitted when unknown).
- Owner to do: set `NEXT_PUBLIC_SITE_URL` to the final domain; add the site to Google Search Console and Bing Webmaster Tools and submit `/sitemap.xml`; replace example contact data (enables LocalBusiness markup).

## Booking chatbot (n8n)
- Architecture: browser chat bubble → `POST /api/chat` (Next.js) → n8n webhook `http://n8n:5678/webhook/grooming-chat` (same Docker network, **not published**) → n8n AI Agent (OpenAI) → tools that call the app's own API at `http://app:3000` (`/api/services`, `/api/availability/days`, `/api/availability`, `/api/booking`). Visitors never talk to n8n; the webhook additionally requires the shared `BOT_SECRET` (`x-bot-secret`), checked in the workflow.
- The chatbot reuses the public booking path unchanged: it creates a pending hold and the customer must still click the e-mail confirmation link. No DB invariant is bypassed; double booking, holds, tokens and e-mail failure handling behave exactly as for the form.
- Bot trust (`src/lib/security/bot-auth.ts`): a request with a valid `BOT_SECRET` skips Turnstile (a bot cannot solve it) and is rate-limited on the visitor's IP (`x-visitor-ip`, forwarded by `/api/chat`) instead of the n8n container's IP, so one chatty visitor cannot exhaust the limits of everyone else. Without the secret nothing changes. `BOT_SECRET` must be >= 32 chars; shorter values are ignored.
- New read-only endpoint `GET /api/services` lists active, booking-enabled services/variants (the chatbot needs their ids). It exposes no customer data.
- `/api/chat` is rate-limited to 20 messages / 10 min / IP to bound LLM cost; messages are max 1000 chars; the browser-generated `sessionId` is only n8n's memory key.
- Consent: the agent must obtain an explicit "yes" to personal-data processing before calling `create_booking` (`consent: true`). This relies on the prompt; the legal text and whether chat consent is sufficient should be reviewed by the owner.
- n8n runs with `N8N_BLOCK_ENV_ACCESS_IN_NODE=false` so the workflow can read `$env.BOOKING_BOT_SECRET` / `$env.APP_BASE_URL` (secrets stay out of the exported JSON). Anyone who can edit workflows in n8n can read those variables, so n8n's editor must stay private (bound to 127.0.0.1; reach it through an SSH tunnel or behind the reverse proxy with n8n's own login).
- The OpenAI API key is stored as an n8n credential (encrypted with `N8N_ENCRYPTION_KEY`), never in the repo or the app.
