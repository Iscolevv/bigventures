# Deploying the dashboard to Vercel

The dashboard (`apps/dashboard`) is a Next.js 16 app in a pnpm monorepo. It
serves both the management UI and the mobile API.

**Live:** https://venturesbig.vercel.app — deployed, DB-connected, seeded.
Admin login: `levismokaya220@gmail.com` (change the password).

## One-time setup

1. **vercel.com → Add New… → Project → Import** `Iscolevv/bigventures`.
2. **Framework Preset**: Next.js (auto-detected).
3. **Root Directory**: `apps/dashboard`  ← important. Leave "Include files
   outside the root directory" **on** (default) so the workspace packages
   `@bv/core` / `@bv/db` resolve.
4. **Build & Output Settings**: leave defaults.
   - Install Command: `pnpm install` (auto from `pnpm-lock.yaml`)
   - Build Command: `next build`
   - Output Directory: `.next`
5. **Node.js Version** (Project Settings → General): **22.x**.

## Environment variables (Project Settings → Environment Variables)

Add for **Production** (and Preview if you want branch deploys):

| Key | Value | Needed for |
|---|---|---|
| `DATABASE_URL` | the Neon `...-pooler...neondb?sslmode=require&channel_binding=require` string | everything |
| `BETTER_AUTH_SECRET` | a fresh 32+ char random string — `openssl rand -base64 32` | auth (required) |
| `BETTER_AUTH_URL` | `https://<your-vercel-domain>` (set after first deploy gives you the URL) | auth callbacks |
| `R2_ENDPOINT` | `https://<accountid>.r2.cloudflarestorage.com` | POD / receipt / doc uploads |
| `R2_BUCKET` | `big-ventures` | uploads |
| `R2_ACCESS_KEY_ID` | from Cloudflare R2 API token | uploads |
| `R2_SECRET_ACCESS_KEY` | from Cloudflare R2 API token | uploads |
| `GOOGLE_MAPS_SERVER_KEY` | Maps Platform key (Directions + Geocoding) | Phase 2 route planning |

R2 and Maps can be added later — the app deploys and runs without them; only
uploads / route planning are inert until they're set.

The database already has the `bigventures` schema migrated and seeded, so the
first deploy comes up with the 8 vehicles and demo drivers already there.

## First login

The seeded driver/ops/management rows have no password. Create a real admin:

```bash
cd apps/dashboard
pnpm create-user "Your Name" you@bigventures.co.ke 'a-strong-password' admin
```

(Run locally against the same `DATABASE_URL`; it writes straight to the shared
DB.) Then sign in at the deployed URL.

## After deploy

- Add `BETTER_AUTH_URL=https://venturesbig.vercel.app` to Vercel env vars and
  redeploy. (Login already works via Vercel's own `VERCEL_PROJECT_PRODUCTION_URL`
  fallback, but set it explicitly before pointing a custom domain or the mobile
  app at it.)
- The mobile app already points here (`apps/mobile/app.json` →
  `extra.apiBaseUrl`).

## Demo data & alerts

```bash
pnpm db:seed                                   # wipe + regenerate ~420 trips etc.
cd apps/dashboard
node --env-file=../../.env --import tsx scripts/scan-alerts.ts   # populate the alerts panel
```

The nightly Vercel cron (`/api/cron/nightly`, see `vercel.json`) does the alert
scan automatically once `CRON_SECRET` is set in Vercel env (Vercel injects the
matching `Authorization: Bearer` header). Without `CRON_SECRET` the endpoint is
open — fine for the pilot, lock it down before real traffic.

## Migrations on future schema changes

```bash
pnpm db:generate      # creates the next drizzle/NNNN_*.sql
pnpm db:migrate       # applies it to the bigventures schema
```

Never run `drizzle-kit push` against this database — it's shared with Moody
Treats. `schemaFilter: ['bigventures']` protects `public`, but migrations are
the safe path.
