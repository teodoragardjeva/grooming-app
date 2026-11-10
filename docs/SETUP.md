# Setup and deployment

The app runs as a Docker Compose stack: **PostgreSQL 16** + one-off **migrations** + the **Next.js app** + a daily **housekeeping** job + **Caddy** (reverse proxy with automatic HTTPS). Everything is defined in `docker-compose.yml`.

| Item | Status | Notes |
|---|---|---|
| GitHub repo `teodoragardjeva/grooming-app` | **todo** | Code is not pushed yet. |
| DigitalOcean droplet + domain | **todo** | See "Deploy to DigitalOcean". |
| `.env` with secrets | **todo** | Copy `env.example` to `.env` (see below). |
| Admin user | **todo** | `scripts/create-admin.mjs`. |
| Resend account, API key, verified domain | **todo** | Without a key, booking requests fail with `email_failed` (the hold is released). |
| Real business details & legal texts | **todo** | Admin → Настройки and Текстове; tick "Данните са реални". |

## 1. Configuration (`.env`)
Copy `env.example` to `.env` next to `docker-compose.yml` (docker compose reads it) and fill it in. Never commit `.env`.

| Variable | Notes |
|---|---|
| `POSTGRES_PASSWORD` | Long random password for the database user. |
| `POSTGRES_DB`, `POSTGRES_USER` | Default `grooming`. |
| `SEED_EXAMPLE_DATA` | `1` once, on a fresh database, loads clearly-fake example services/hours. Leave `0` in production. |
| `NEXT_PUBLIC_SITE_URL` | Final public URL, e.g. `https://example.com` (e-mail links, sitemap, hreflang). Inlined at build time, so rebuild after changing it. |
| `SITE_ADDRESS` | Domain for Caddy's automatic HTTPS (e.g. `example.com`); `:80` = plain HTTP for local use. |
| `TOKEN_HASH_SECRET` | Random string ≥ 32 chars (`openssl rand -hex 32`). Changing it invalidates outstanding e-mail links. |
| `CRON_SECRET` | Random string ≥ 16 chars; the housekeeping job sends it as `Authorization: Bearer …`. |
| `RESEND_API_KEY`, `RESEND_FROM` | From the Resend dashboard; `RESEND_FROM` must be on a verified domain, e.g. `Магически Лапички <no-reply@your-domain>`. |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY` | Optional Cloudflare Turnstile. |

## 2. Run locally with Docker
```bash
cp env.example .env        # then edit it; set SEED_EXAMPLE_DATA=1 for demo data
docker compose up -d --build
```
The site is on http://localhost. The `migrate` service applies `db/migrations/*.sql` (each file once, tracked in `public.schema_migrations`) before the app starts; re-running `docker compose up -d` applies new migrations.

## 3. Create the admin user (no public registration exists)
```bash
docker compose run --rm -e ADMIN_EMAIL=you@example.com -e ADMIN_PASSWORD='a long passphrase (12+ chars)' app node scripts/create-admin.mjs
```
Run it again with a new password to reset one (this also signs the account out everywhere). Then open `/admin/login`. Sessions last 7 days and are stored server-side (`admin_sessions`).

## 4. Deploy to DigitalOcean
1. Create a **Droplet** (Ubuntu 24.04, at least 2 GB RAM; the image build needs memory) and enable **backups**. Point your domain's A record at the droplet IP.
2. Install Docker: follow https://docs.docker.com/engine/install/ubuntu/ (then `sudo usermod -aG docker $USER`).
3. Firewall (DO Cloud Firewall or `ufw`): allow 22, 80 and 443 only. The database is not published to the host.
4. Get the code on the droplet (`git clone https://github.com/teodoragardjeva/grooming-app.git` once it is pushed), create `.env` with `SITE_ADDRESS=your-domain`, `NEXT_PUBLIC_SITE_URL=https://your-domain` and real secrets.
5. `docker compose up -d --build`. Caddy obtains the TLS certificate automatically once DNS points at the droplet.
6. Create the admin user (step 3) and fill in the first-run checklist.

Updating: `git pull && docker compose up -d --build`.

## 5. Backups (important)
Data lives in two Docker volumes: `grooming_pgdata` (database) and `grooming_media` (uploaded images).
```bash
# database dump
docker compose exec -T db sh -c 'pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB"' | gzip > backup-$(date +%F).sql.gz
# restore into an empty database
gunzip -c backup-2026-01-01.sql.gz | docker compose exec -T db sh -c 'psql -U "$POSTGRES_USER" "$POSTGRES_DB"'
# images
docker run --rm -v grooming_media:/data -v "$PWD":/out alpine tar czf /out/media-$(date +%F).tgz -C /data .
```
Schedule these (cron on the droplet) and copy the files off the droplet (e.g. to a DigitalOcean Space). DO droplet backups are an additional safety net, not a replacement for tested dumps.

## 6. Housekeeping
The `cron` service calls `/api/cron/cleanup` once a day (expired holds, old tokens/sessions). Correctness never depends on it: expired holds are also released at request time.

## 7. First-run checklist
1. Admin → Работно време: confirm hours.
2. Admin → Услуги: replace the example services/prices.
3. Admin → Настройки: real name, phone, address; tick "Данните са реални".
4. Admin → Текстове: About, hours, privacy/terms/cookies (replace DRAFT text; legal review recommended).
5. Admin → Галерия: upload real photos with alt text.
6. Make a test booking end-to-end (request → email → confirm → cancel).

## Tests
```bash
npm run test:db            # SQL-level tests in a throwaway PostgreSQL container (Docker required)
npm run test:integration   # use-case tests against the same throwaway database
npm run test:db:down       # remove the test containers
```

## Troubleshooting
- Admin login says the system is not connected to the database: `DATABASE_URL` is missing (only when running outside Docker).
- Booking returns `not_configured`/503: `DATABASE_URL` or `TOKEN_HASH_SECRET` missing.
- Booking returns `email_failed`: `RESEND_API_KEY`/`RESEND_FROM` missing or the domain is not verified; check Admin → Журнал.
- Logs: `docker compose logs -f app`.
