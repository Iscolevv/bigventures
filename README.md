# Big Ventures — Fleet Intelligence

Monorepo for the Big Ventures fleet, trip, fuel, cost and delivery system:
an offline-first Android driver app and a management dashboard sharing one
Postgres backend.

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for the full design.

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

Phase 1 foundation in place: full schema + RBAC + shared calculations +
idempotent offline-sync API + both app shells. Next up per phase plan:
Phase 1 driver flows (vehicle check UI, POD camera capture, fuel form) and
the Phase 1 dashboard views (trip log, fuel consumption).
