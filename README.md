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

## Getting started
Copy `env.example` to `.env` and fill in the values, then `docker compose up -d --build` (see [`docs/SETUP.md`](docs/SETUP.md)). Never commit secrets. The public shell runs without credentials; booking and admin need the database.
