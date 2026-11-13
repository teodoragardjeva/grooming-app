# Setup and deployment

The app runs as a Docker Compose stack: **PostgreSQL 16** + one-off **migrations** + the **Next.js app** + the **n8n** chatbot + a daily **housekeeping** job. HTTPS and the domain are handled by **Nginx Proxy Manager (NPM)**, which already runs on the server (ports 80/443) as a separate stack and forwards to the `app` service over the external `proxy` network. The app stack publishes no ports itself. Everything is defined in `docker-compose.yml`.

| Item | Status | Notes |
|---|---|---|
| GitHub repo `teodoragardjeva/grooming-app` | **todo** | Code is not pushed yet. |
| Server + domain + Nginx Proxy Manager | **todo** | See "Deploy behind Nginx Proxy Manager". |
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
| `TOKEN_HASH_SECRET` | Random string ≥ 32 chars (`openssl rand -hex 32`). Changing it invalidates outstanding e-mail links. |
| `CRON_SECRET` | Random string ≥ 16 chars; the housekeeping job sends it as `Authorization: Bearer …`. |
| `RESEND_API_KEY`, `RESEND_FROM` | From the Resend dashboard; `RESEND_FROM` must be on a verified domain, e.g. `Магически Лапички <no-reply@your-domain>`. |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY` | Optional Cloudflare Turnstile. |

## 2. Run locally with Docker
```bash
cp env.example .env        # then edit it; set SEED_EXAMPLE_DATA=1 for demo data, APP_IMAGE_TAG to the image tag
docker compose pull && docker compose up -d   # uses the GHCR image; for code changes use `npm run dev`
```
The stack publishes no ports (NPM reaches `app` over the Docker network), and the compose file expects the external network `nginx-proxy-manager_default`; for a purely local run use `npm run dev`, or create that network first (`docker network create nginx-proxy-manager_default`) and add a temporary `ports: ["3000:3000"]` to `app` in a local override file. The `migrate` service applies `db/migrations/*.sql` (each file once, tracked in `public.schema_migrations`) before the app starts; re-running `docker compose up -d` applies new migrations.

## 3. Create the admin user (no public registration exists)
```bash
docker compose run --rm -e ADMIN_EMAIL=you@example.com -e ADMIN_PASSWORD='a long passphrase (12+ chars)' app node scripts/create-admin.mjs
```
Run it again with a new password to reset one (this also signs the account out everywhere). Then open `/admin/login`. Sessions last 7 days and are stored server-side (`admin_sessions`).

## 4. Deploy behind Nginx Proxy Manager (Portainer)
The server already runs **Nginx Proxy Manager (NPM)** on ports 80/443; it owns the domain and HTTPS. This stack publishes no ports and has no reverse proxy of its own. `app` joins NPM's Docker network (declared as `proxy` in `docker-compose.yml`, name `nginx-proxy-manager_default`) so NPM can reach it by name. If NPM is recreated with a different stack name, the network name changes too: update it in `docker-compose.yml`.

1. Point the domain's DNS A record (e.g. `magic-paws.robodigit.win`) at the server.
2. Firewall: allow 22, 80 and 443 only. The database and n8n are not published to the public network.
3. In **Portainer → Stacks → Add stack → Repository**: repository URL `https://github.com/teodoragardjeva/grooming-app.git`, reference `refs/heads/main`, compose path `docker-compose.yml`. Add the variables from section 1 as environment variables (`POSTGRES_PASSWORD`, `TOKEN_HASH_SECRET`, `CRON_SECRET`, `BOT_SECRET`, `N8N_ENCRYPTION_KEY`, `NEXT_PUBLIC_SITE_URL=https://your-domain`, Resend keys, …). Deploy the stack. Set `APP_IMAGE_TAG` to the version to run (e.g. `1.2.3`; default `latest`). Portainer pulls the `app` image from GHCR (the package must be public, or add a GHCR registry with a GitHub token in Portainer) and builds only the tiny `migrate` image on the server; the stack uses no bind mounts. `NEXT_PUBLIC_SITE_URL` is inlined at build time, so re-deploy with "Re-pull image and redeploy" after changing it.
4. In **NPM → Hosts → Proxy Hosts → Add Proxy Host**:
   - Domain Names: your domain (e.g. `magic-paws.robodigit.win`)
   - Scheme: `http`, Forward Hostname / IP: `app`, Forward Port: `3000`
   - Enable "Block Common Exploits" and "Websockets Support" (optional)
   - SSL tab: request a new **Let's Encrypt** certificate, enable **Force SSL** (and HTTP/2)
5. Create the admin user (section 3, e.g. from the Portainer container console of `app` or `docker compose run`) and fill in the first-run checklist.

Updating: run the Release workflow (see below), then in Portainer open the stack → change `APP_IMAGE_TAG` to the new version → **Update the stack** (enable "Re-pull image"). `NEXT_PUBLIC_SITE_URL` is baked into the image at build time: set it as the GitHub repository variable `NEXT_PUBLIC_SITE_URL`, not in Portainer.

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

## 5b. Chatbot (n8n)
The `n8n` service runs in the same compose network as the app. Set `BOT_SECRET` and `N8N_ENCRYPTION_KEY` in `.env` (`openssl rand -hex 32` each).
1. Open the editor through an SSH tunnel (it is bound to the server's loopback only): `ssh -L 5678:localhost:5678 user@server`, then http://localhost:5678, and create the owner account.
2. Import `n8n/grooming-chatbot.workflow.json` (Workflows → Import from file; or `docker compose exec n8n n8n import:workflow --input=...`).
3. Open the **OpenAI Chat Model** node, create an OpenAI credential with your API key, and select it. Then open **Postgres Chat Memory** and create a Postgres credential: host `db`, port `5432`, database and user from your `.env` (`POSTGRES_DB`, `POSTGRES_USER`), password `POSTGRES_PASSWORD`, SSL disabled. Chat history is stored in the table `n8n_chat_histories` (the node default, created automatically) in the app database, so it survives n8n restarts.
4. Toggle the workflow **Active**. The visitor chat bubble (`/api/chat`) then works; until then it answers that the chat is unavailable.
5. Test: ask for an appointment in the bubble. Without Resend configured, the final booking step returns `email_failed` and nothing is booked.

The webhook is reachable only inside the Docker network. If you change the webhook path in the workflow, change `N8N_CHAT_WEBHOOK_URL` in `docker-compose.yml` too.

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

## Release a versioned image (manual)
GitHub → **Actions → Release → Run workflow**: pick the branch, enter a semver version (`1.2.3`, no leading `v`; pre-releases like `1.2.3-rc.1` are fine) and optionally tick "latest". The workflow rejects invalid versions and versions whose tag already exists, builds the image and pushes `ghcr.io/teodoragardjeva/grooming-app:<version>` (plus a `sha-…` tag), then creates the git tag `v<version>`. It does not re-run the tests: release from a commit whose CI is green. The workflow only appears in the Actions list once `release.yml` is on `main`.
