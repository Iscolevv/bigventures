# Big Ventures — Fleet Intelligence

Monorepo for the Big Ventures fleet, trip, fuel, cost and delivery system:
an offline-first Android driver app and a management dashboard sharing one
Postgres backend.

- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — full design, data model, phase plan
- [`docs/DEPLOY.md`](docs/DEPLOY.md) — Vercel setup + first-login steps

## Database

This project shares a Neon database with Moody Treats. Every Big Ventures table
lives in a dedicated **`bigventures`** Postgres schema (Better Auth included), so
there is zero collision with Moody Treats' `public` tables. `drizzle.config.ts`
sets `schemaFilter: ['bigventures']` — migrations never touch `public`.

## Layout

| Path | |
|---|---|
| `packages/core` | Domain layer — enums, RBAC, geo math, all money calculations. No framework deps. |
| `packages/db` | Drizzle schema, client, migrations, seed, analytics queries. |
| `apps/dashboard` | Next.js 16 — management dashboard **and** the mobile API. |
| `apps/mobile` | Expo / React Native driver app. |

## Getting started

```bash
pnpm install
cp .env.example .env            # fill in DATABASE_URL, BETTER_AUTH_SECRET, R2_*, GOOGLE_MAPS_*

# database
pnpm db:generate                # generate SQL migration from the schema
pnpm db:migrate                 # apply to Neon
pnpm db:seed                    # demo fleet + drivers + incentive rule

# run
pnpm dev:dashboard              # http://localhost:3000
pnpm dev:mobile                 # Expo dev client (Android)

# checks
pnpm --filter @bv/core test
pnpm typecheck
```

## Status

**Phases 1–3 built.** Live dashboard: https://venturesbig.vercel.app

- **Dashboard** — overview, fleet, drivers, trips (+ detail with route map),
  fuel & consumption anomalies, costs & advances, ROI & route analytics,
  incentives & payroll (editable rule, generate/approve runs), invoicing
  (draft-from-trips), documents, alerts panel, audit trail, settings. All
  RBAC-gated. CSV export on the money views.
- **Backend** — idempotent mobile sync API, R2 presigned uploads, 10-scanner
  alert engine + nightly Vercel cron, append-only audit log.
- **Driver app** — mobile-first web app at **`/d`** (no install: drivers open
  the site on their phone): trips, vehicle check, multi-drop with GPS pin,
  camera-only POD, fuel entry, document upload, foreground GPS trail. An Expo
  native app (`apps/mobile`) is also built as the offline / background-GPS
  fallback.

Phase 4 (client portal, predictive maintenance, behaviour scoring) is
architected, not built. See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) §9.
