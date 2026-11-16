# Магически Лапички — Dog Grooming Studio

Wizard-school-themed boutique dog grooming studio: bilingual (Bulgarian default, English at `/en`) public website and appointment management system. Prices in EUR.

> Status: Phase 1 done (Next.js app shell with Bulgarian/English routing, design tokens, header/footer, placeholder pages),
> plus the database layer, availability engine, token hashing and email templates. Public content, booking UI and admin come in later phases.
> See [`docs/PLAN.md`](docs/PLAN.md).

## Documents
- [`CLAUDE.md`](CLAUDE.md) — instructions and invariants for AI-assisted development
- [`docs/SPEC.md`](docs/SPEC.md) — authoritative product specification
- [`docs/DECISIONS.md`](docs/DECISIONS.md) — decisions and overrides to the spec
- [`docs/DESIGN.md`](docs/DESIGN.md) — design direction (mockup in `docs/design/`)
- [`docs/PLAN.md`](docs/PLAN.md) — phased plan and progress
- [`docs/SETUP.md`](docs/SETUP.md) — setup, Docker and DigitalOcean deployment

## Stack
Next.js (App Router, TypeScript strict), Tailwind CSS + shadcn/ui, PostgreSQL 16 (node-postgres), own admin login, Docker, Resend, React Hook Form + Zod, next-intl, Vitest, Playwright.

## Commands
```
npm install
npm run dev          # http://localhost:3000  (Bulgarian at /, English at /en)
npm run lint && npm run typecheck && npm test && npm run build
npm run test:db      # real PostgreSQL 16 integration tests (schema, races, constraints; runs in Docker)
npm run test:e2e     # Playwright (first: npx playwright install chromium, or PW_CHANNEL=chrome to use installed Chrome)
```

## Security audit (`/cso`, 2026-11-16)

Full daily-mode audit (confidence gate 8/10) of code, dependencies, secrets history, CI/CD, Docker/Compose, the n8n chatbot and the database layer. Three findings survived the gate; all three are fixed in code.

| # | Severity | Conf. | Finding | Status |
|---|----------|-------|---------|--------|
| 1 | HIGH | 9/10 | Rate limits keyed on a client-controlled IP (`X-Forwarded-For` first entry) | Fixed |
| 2 | MEDIUM | 8/10 | No security response headers (clickjacking on `/admin`, token URLs leaked via `Referer`) | Fixed |
| 3 | HIGH | 8/10 | Third-party GitHub Actions pinned to mutable tags in jobs with `packages: write` / `contents: write` | Fixed |

### 1. Spoofable client IP bypasses all rate limits — `src/lib/security/rate-limit.ts`
`clientIp()` used the **first** `X-Forwarded-For` entry. Nginx Proxy Manager *appends* the real peer to whatever the client sent, so the first entry is attacker-controlled.
- **Exploit:** an attacker sends `X-Forwarded-For: <random>` with every request. Each request lands in a fresh rate-limit bucket, so the admin login throttle (8 attempts / 15 min) never triggers (unlimited password guessing), `/api/booking` can be used to spam confirmation emails, and `/api/chat` can be used to run up OpenAI cost (the same forged value is forwarded to n8n as `x-visitor-ip`).
- **Fix:** trust `X-Real-IP` (overwritten by NPM with the real peer), otherwise the **last** `X-Forwarded-For` entry. Unit test added in `tests/unit/bot-auth.test.ts`.
- **Deployment requirement:** the app must only be reachable through NPM (it is: no published ports). If a CDN such as Cloudflare is ever put in front of NPM, `X-Real-IP` becomes the CDN address — revisit `clientIp()` then.

### 2. Missing security headers — `next.config.ts`
- **Exploit:** the admin panel could be embedded in an attacker's page and a logged-in admin tricked into clicking (clickjacking); confirm/cancel tokens live in the page URL and could leak to third-party sites through the `Referer` header.
- **Fix:** added `X-Frame-Options: DENY`, CSP `frame-ancestors 'none'` (+ `base-uri`, `form-action`, `object-src`), `X-Content-Type-Options`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy`, `Strict-Transport-Security`.

### 3. Unpinned GitHub Actions — `.github/workflows/ci.yml`, `release.yml`
- **Exploit:** a moved/compromised `docker/*@v3` tag would run attacker code in the job that holds `packages: write` (push malicious images to GHCR, which production pulls) and `contents: write`.
- **Fix:** every action is pinned to a commit SHA (tag kept as a comment); `.github/CODEOWNERS` now requires the owner's review for workflow changes. Dependabot (`github-actions` ecosystem) is recommended to keep the pins current.

### Checked and found clean
- **Secrets:** no secret patterns in git history; `.env` is ignored and was never tracked; only `.env.example` is committed.
- **Dependencies:** `npm audit --omit=dev` reports 0 vulnerabilities; lockfile is tracked.
- **Injection:** the query builder validates identifiers and binds every value; no `eval`/`exec`; `dangerouslySetInnerHTML` is used only for JSON-LD with `<` escaped; email templates HTML-escape all user values.
- **Authorization:** every admin server action calls `requireAdmin()`; the admin layout/pages are guarded server-side; sessions are random 256-bit tokens stored hashed (httpOnly, `SameSite=Lax`, `Secure` on https).
- **Uploads / files:** images are accepted by magic bytes only (JPEG/PNG/WebP, 5 MB), stored under random UUID names, and `/media` rejects path traversal and serves a fixed MIME type with `nosniff`.
- **Tokens and secrets:** confirm/cancel tokens are HMAC-hashed at rest; `CRON_SECRET` and `BOT_SECRET` are compared in constant time; n8n's webhook is not published and requires the shared secret.

### Residual risks (below the confidence gate or operational — not code bugs)
- **Turnstile is silently off when `TURNSTILE_SECRET_KEY` is unset.** Set it (and `NEXT_PUBLIC_TURNSTILE_SITE_KEY`) in production.
- **No `script-src` CSP.** Next.js inline scripts need a nonce-based policy; the current CSP only covers framing/forms/objects.
- **Booking confirmation emails go to any address the visitor types** (inherent to the design; limited to 3 per address per 10 min and 5 per IP).
- **No per-account lockout** on admin login (only per-IP throttling); scrypt uses N=16384 (acceptable; OWASP currently recommends N=2^17 for new hashes).
- **n8n:** `N8N_BLOCK_ENV_ACCESS_IN_NODE=false` lets workflow code nodes read container env vars; only trusted editors should access the n8n UI (loopback/SSH tunnel today).
- **Docker base images** (`node:22-alpine`, `postgres:16-alpine`, `alpine:3`) are tag-pinned, not digest-pinned.
- **Not covered:** `.claude/settings.json` and `.env.example` could not be read in this session; global (user-level) skills were not scanned. No `.gitleaks.toml` exists — adding one is recommended.

> Not a substitute for a professional security audit. `/cso` is an AI-assisted scan that catches common vulnerability patterns; it is not comprehensive and can miss subtle issues. For production systems handling personal data, engage a qualified penetration-testing firm.

## Getting started
Copy `env.example` to `.env` and fill in the values, then `docker compose up -d --build` (see [`docs/SETUP.md`](docs/SETUP.md)). Never commit secrets. The public shell runs without credentials; booking and admin need the database.
