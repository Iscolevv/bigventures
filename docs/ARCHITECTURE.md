# Big Ventures — Fleet, Trip & Payment Intelligence System

**Architecture & delivery plan · v0.1 · 2026-09**

This document is the technical response to the project brief. It confirms the
stack, refines the data model, sets out the offline-sync and geofencing
design, and lays out what we need from Big Ventures to move.

---

## 1. Shape of the system

Two clients, one backend, one database.

```
┌─────────────────────┐         ┌──────────────────────────┐
│  Driver app         │  HTTPS  │  Dashboard + API         │
│  Expo / React Native│────────▶│  Next.js on Vercel       │
│  Android, offline-  │  sync   │  - REST for the app      │
│  first (SQLite)     │◀────────│  - server-rendered UI    │
└─────────┬───────────┘         │  - background jobs (cron)│
          │ presigned PUT       └────────┬──────────┬──────┘
          ▼                              │          │
┌─────────────────────┐        ┌─────────▼───┐  ┌───▼─────────┐
│  Cloudflare R2      │        │ Neon        │  │ Google Maps │
│  POD photos,        │        │ Postgres    │  │ Directions +│
│  receipts, docs     │        │ (Drizzle)   │  │ Geocoding   │
└─────────────────────┘        └─────────────┘  └─────────────┘
```

**Monorepo** (`pnpm` workspaces):

| Package | What it is |
|---|---|
| `packages/core` | Framework-free domain layer: every enum, the RBAC matrix, geo/geofence math, and all money calculations (fuel efficiency + anomaly, incentive engine, ROI, payroll netting, quality score). Imported by **both** apps so the app and the dashboard never disagree on a number. |
| `packages/db` | Drizzle schema (one source of truth for the Postgres structure), the DB client, migrations, seed, and hand-written analytics queries. |
| `apps/dashboard` | Next.js 16 web dashboard **and** the backend API the mobile app talks to (same deployment). |
| `apps/mobile` | Expo/React Native Android app for drivers. |

Why this split: the brief calls out that every dashboard view (ROI per
vehicle, incentive per driver, route cost) should be a *query across shared
tables*, not separate data entry. Putting the schema and the calculations in
shared packages is how we hold that line.

---

## 2. Stack decisions

| Concern | Choice | Why |
|---|---|---|
| Driver client | **Web app at `/d`** (primary) + Expo/RN app (optional) | The web driver app is mobile-first pages in the same Next.js deployment — drivers just open `venturesbig.vercel.app` on their phone, no APK. Camera via `<input capture>`, GPS via `navigator.geolocation`, trail recorded while the trip screen is open. The Expo app (`apps/mobile`, fully built) is the fallback when true *background* GPS tracking on long hauls matters — it has a foreground-service location task and an offline SQLite queue. |
| Backend + dashboard | **Next.js 16 on Vercel** | Same stack already proven on the Moody Treats build. API routes serve the mobile app; server components render the dashboard. |
| Database | **Neon Postgres + Drizzle ORM** | Relational model (vehicles → trips → drops → PODs, all cross-referenced). Neon branching gives cheap preview environments. |
| Auth | **Better Auth** | Email/password for office users and drivers, one user table, `role` drives RBAC. The mobile app authenticates against the same endpoint with a bearer token. |
| File storage | **Cloudflare R2** | POD photos + receipts + documents are the biggest cost driver over time. R2 has no egress fees and is ~1/4 the effective cost of Vercel Blob at photo volume. S3-compatible, so no lock-in. |
| Maps | **Google Maps Platform** — Directions + Geocoding (server), Maps SDK for Android (app) | Best Kenya coverage. Server key is usage-capped; routes are cached on the trip so we call Directions once per trip. |
| Background jobs | **Vercel Cron** | Nightly: document-expiry scan, overdue-advance/-invoice scan, fuel-anomaly pass, maintenance-due check, quality-snapshot + payroll draft at month end. |

---

## 3. Data model (refined from the brief)

Full schema in [`packages/db/src/schema`](../packages/db/src/schema). Entity groups:

- **Access** — `user` (Better Auth) + `role` (`driver | operations | management | admin`) + `status`.
- **Fleet** — `drivers` (HR/compliance/payroll extension of a user), `vehicles` (incl. `monthly_finance_cost` = the SACCO/coop/NCBA contribution, used as ROI overhead), `vehicle_assignments` (history; one open assignment per vehicle).
- **Trips** — `routes`, `trips` (planned distance/duration/polyline from Directions, `route_key` for analytics grouping), `drops` (one-to-many, sequenced, geofenced, issue category), `pod_photos` (R2 key + captured GPS/time + sha256, camera-only), `vehicle_checks` + `vehicle_check_items` (template in `@bv/core/reference`, blocking items gate trip start), `trail_segments` (GPS batched as JSON, not row-per-fix), `trip_deviations`.
- **Money** — `fuel_entries`, `cost_entries` (repair/service/tyres/parking/police/fine/boda/welding/…), `advances` (ledger: disbursed / repaid / written-off), `incentive_rules` (JSON config, editable by ops/management — **no code change to retune tiers**), `quality_snapshots`, `payroll_runs` (base + incentive − advance − loss, with a take-home floor), `clients`, `client_rates`, `invoices` + `invoice_lines` + `payments`.
- **Documents** — one `documents` table for driver + vehicle + company docs, each with `expiry_date` feeding the alerts panel. Types & warn-windows in `@bv/core/reference`.
- **Ops** — `alerts` (deduped so one condition = one open alert), `audit_log` (append-only, every tracked mutation), `devices`, `sync_batches` (idempotency + record of every mobile push), `settings`.

Every mobile-writable table carries a `client_uuid` with a partial-unique
index — the backbone of idempotent sync.

---

## 4. RBAC (built in from day one)

Two enforced layers, both server-side ([`packages/core/src/rbac.ts`](../packages/core/src/rbac.ts)):

1. **Capability** — `can(role, 'trip:approve')`. A per-role list of
   `resource:action` grants (`operations` gets `trip:*`, `management` is
   read + `payroll:approve` + `incentive_rule:*`, `driver` is a short
   own-data list, `admin` is `*`).
2. **Row scope** — `rowScope('driver') === 'own'`. The query layer turns that
   into `WHERE driver_id = $me`. Drivers can only ever see and touch their own
   trips, uploads, and advance balance. They also can't mutate a trip once
   it's `completed`/`flagged`.

The client uses `can()` to hide UI; the server re-checks every request.

---

## 5. Offline-first sync (the core of the mobile app)

The app **never** reads or writes the network from a screen. Every screen
hits local SQLite. A background loop reconciles.

```
screen ──write──▶ SQLite row (sync_state='dirty')
                     │
   on foreground / connectivity / timer / after each mutation
                     ▼
        sync.ts:  1. upload pending photos → R2 (presigned PUT)
                  2. build ONE SyncBatch from every dirty row
                  3. POST /api/mobile/sync  (batchId = idempotency key)
                  4. reconcile: idMap → write server_id, sync_state='synced'
                               conflicts/rejected → sync_state='conflict'
```

- **Idempotent both ends.** The whole batch is keyed by `batchId`; every
  entity by `client_uuid`. A dropped connection just means the next batch
  re-sends — no duplicates.
- **Parents before children.** Trips upsert first; a drop or POD whose parent
  isn't on the server yet comes back as a *conflict* and rides the next batch.
- **Photos never touch our server.** Client compresses (≤1600px, q0.6),
  hashes, asks for a presigned R2 URL, uploads direct. The batch carries only
  the storage key. Camera capture only — gallery picks are rejected in the UI
  so a POD can't be an old photo.
- **Contract** is a Zod schema in [`@bv/core/dto/sync`](../packages/core/src/dto/sync.ts),
  shared by app and server.

Conflicts surface in a "Needs review" list in the app rather than being
silently overwritten.

---

## 6. Trip mapping & geofencing

- On trip creation the server calls **Directions** once, stores the encoded
  polyline + distance + duration on the trip.
- While `in_progress`, a foreground-service location task
  ([`mobile/src/lib/location.ts`](../apps/mobile/src/lib/location.ts)) samples
  at 15 s / 40 m, `Balanced` accuracy — enough to reconstruct the route
  without draining the battery.
- Each fix is checked against the loading-point geofence (150 m) and every
  pending drop's geofence (120 m default, per-drop override). Entering a
  drop's fence stamps `arrived_at` and moves it to `arrived`.
- Marking a drop delivered with **no** geofence entry sets `geofence_skipped`
  → a `route_deviation` / review flag on the dashboard.
- Off-route detection (`@bv/core/geo.checkDeviation`) runs server-side on the
  trail after sync: > ~300 m off the planned line for N consecutive points
  raises a `route_deviation` alert.

---

## 7. Calculations live in one place

[`packages/core/src/calc`](../packages/core/src/calc), unit-tested:

- **Fuel** — full-to-full L/100km, rolling per-vehicle baseline, anomaly needs
  *both* >20 % over the mean *and* >2σ before it flags.
- **Incentive** — marginal tiers (like tax brackets, so crossing a boundary
  never cuts take-home), a quality multiplier with a floor, an optional period
  cap. Config is JSON, edited from the dashboard.
- **ROI** — vehicle: revenue − fuel − running − allocated finance overhead;
  driver: revenue − fuel − running − wages. Plus `routeCostSummary` (min /
  mean / median / p90 of fuel, distance, time per `route_key`).
- **Quality** — weighted composite of on-time %, damage-free %, check
  compliance, POD compliance, minus a per-incident penalty.
- **Payroll** — net = base + incentive − loss instalment − advance recovery,
  with a configurable take-home floor; unrecovered balance rolls forward.

---

## 8. Hosting & cost (needs your volume numbers — see §10)

| Service | Plan | Est. monthly |
|---|---|---|
| Vercel | Pro | ~$20 |
| Neon | Launch | ~$19 |
| Cloudflare R2 | pay-as-you-go | **depends on photo volume** — 10 GB stored + modest ops ≈ $1–2; the point is it stays cheap and has zero egress |
| Google Maps | pay-as-you-go | Directions ≈ $5 / 1,000 trips; Geocoding similar. With per-trip caching, well within the $200/mo free credit at your volume |
| Expo EAS | free / $0 to start | build APKs; Play Store internal track |

Ballpark **$60–80/month** at the current fleet size, dominated by fixed
platform fees, not usage. Everything is S3-/Postgres-standard so we can move
to a single VPS later without a rewrite if that ever makes sense.

---

## 9. Build phasing

| Phase | Scope | Status |
|---|---|---|
| **1 — MVP** | Driver: trip logging, vehicle check, fuel entry, POD capture, document upload. Dashboard: trip log, fleet & driver overview, fuel consumption. Offline sync end-to-end. | **built** — sync API, RBAC, all Phase-1 screens both sides |
| **2** | Trip mapping / geofencing, cost & advance tracking, ROI dashboard, route-cost analytics. | **built** — trail task + geofence, trip map (planned vs actual), costs & advances views, per-vehicle ROI, route roll-up |
| **3** | Incentive engine, invoicing automation, exception/alerts panel, accounting (CSV/Excel) export. | **built** — live incentive/payroll preview + runs, invoice-from-trips, 10-scanner alert engine + nightly cron, CSV export, audit trail |
| **4 — later** | Client portal, predictive maintenance, driver-behaviour scoring. Architected for, not built. | not started |

Remaining polish before a pilot: Google Directions on trip creation (needs the
Maps key), push notifications, driver behaviour scoring, and hardening the
mobile sync loop under real field conditions.

---

## 10. What we need from Big Ventures

1. **Volume numbers** — trips/month now and expected in 12 months; photos per
   drop (1? 2?); how long PODs/receipts must be retained. Drives the R2 line.
2. **The vehicle list** with, per unit: insurance & NTSA inspection expiry,
   logbook ref, current odometer, and the exact monthly finance/SACCO figure.
3. **The driver list** with licence numbers + expiry, base salary, current
   advance balance, current at-fault loss balance.
4. **Incentive rules as they stand today** — the trip thresholds and per-trip
   amounts you currently pay, so we seed the rule correctly.
5. **Client + rate card** — who you invoice and at what rate (per trip / per
   km / per drop / monthly).
6. **Which accounting tool** you use or plan to, so the export matches.
7. Google Cloud billing account (for the Maps key) or authorise us to set one
   up under Big Ventures.
8. Two or three drivers for a two-week Phase 1 field pilot.

---

## 11. Repo layout

```
big-ventures/
├─ apps/
│  ├─ dashboard/     Next.js 16 — dashboard + API
│  │  ├─ app/(app)/          dashboard routes (RBAC-gated)
│  │  ├─ app/api/mobile/     sync + mobile endpoints
│  │  ├─ app/api/uploads/    R2 presign
│  │  └─ lib/                auth, session, r2, mobile-auth
│  └─ mobile/        Expo / React Native driver app
│     ├─ app/                expo-router screens
│     └─ src/lib/            localdb, outbox, sync, uploads, location, auth
├─ packages/
│  ├─ core/          enums, rbac, geo, reference, calc/*, dto/*
│  └─ db/            schema/*, queries/*, migrate, seed
└─ docs/
```
