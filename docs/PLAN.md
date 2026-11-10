# Implementation plan

Phases follow `docs/SPEC.md` §16. Tick a box only when the acceptance criteria were **actually verified** (lint, typecheck, tests, build as applicable).

The application features (Phases 0–9) were built earlier; on 2026-11-10 the project was moved to a new stack (PostgreSQL in Docker, own admin login, DigitalOcean) and starts fresh on the new infrastructure.

## Migration to PostgreSQL + Docker + DigitalOcean
- [x] Database: plain PostgreSQL 16 migrations in `db/migrations/` (no RLS, no special roles); admin accounts and sessions tables; `db/migrate.sh`.
- [x] App: `pg` pool + query builder (`src/lib/db`), own admin login (scrypt + server-side sessions), media on disk (`/media/*`).
- [x] Docker: multi-stage `Dockerfile` (Next.js standalone), `docker-compose.yml` (db, migrate, app, cron, caddy), `scripts/create-admin.mjs`.
- [x] Tests: SQL tests and use-case integration tests run on a throwaway PostgreSQL container (`docker-compose.test.yml`).
- [ ] Push the code to `teodoragardjeva/grooming-app`.
- [ ] Create the DigitalOcean droplet, DNS, `.env`; first deploy (see `docs/SETUP.md`).
- [ ] Resend account + verified domain; real e-mail delivery test.
- [ ] Scheduled database and media backups copied off the droplet.
- [ ] First-run content: real business details, services, photos, legal texts.

## Feature phases (built earlier, re-verified on the new stack where noted)
- [x] Phase 0 — Repo scaffolding
- [x] Phase 1 — Setup & UI shell
- [x] Phase 2 — Database & admin auth (now: PostgreSQL + own auth)
- [x] Phase 3 — Public content from the database
- [x] Phase 4 — Services & availability engine
- [x] Phase 5 — Booking holds & concurrency
- [x] Phase 6 — Email confirmation (*real Resend delivery not exercised yet*)
- [x] Phase 7 — Admin calendar & operations
- [x] Phase 8 — Content management (gallery uploads now on the media volume)
- [x] Phase 9 — Self-cancellation, security, a11y, tests

## Verified on 2026-11-10 (executed, not assumed)
- `npm run lint`, `npm run typecheck`: clean. `npm test`: 26 Node tests + 52 Vitest tests passed (includes the new query-builder tests).
- `npm run test:db`: **133 passed, 0 failed** (PostgreSQL 16 in Docker: schema, booking invariants, 12-way race, DST, retention, admin tables).
- `npm run test:integration`: **23 passed** (booking use-cases against real PostgreSQL).
- Docker smoke test of the full stack (`docker compose up --build`): migrations + seed applied; `/`, `/en`, `/admin/login`, `/sitemap.xml` respond; admin created with `create-admin.mjs`; login works in a browser; all admin pages render (200); a gallery upload wrote the file to the volume and the row to the DB, `/media/...` serves it (path traversal and `.svg` get 404); availability API lists days/slots; a booking request without Resend keys returned `email_failed` and released the hold (no leftover allocation).

## NOT verified (honest gaps)
- `npm run build` outside Docker and `npm run test:e2e` were not re-run after the migration (the Docker image build runs `next build` and succeeded).
- Real e-mail delivery (no Resend key), HTTPS/Caddy with a real domain, and a DigitalOcean deployment have not been done.
- `tests/e2e/booking.spec.ts` (live booking + admin login) is gated on `E2E_LIVE=1` and has not been run.
- The CI workflow has not run on GitHub yet.
- No manual screen-reader pass.
- Legend: `[x]` done and verified at the level described, `[ ]` not started.

## Per-phase checklist
1. State dependencies, choices, acceptance criteria.
2. Implement incrementally with tests.
3. Run lint, typecheck, tests, build; fix.
4. Report what works and what needs credentials/owner action.
5. Update this file and `DECISIONS.md`; commit.
