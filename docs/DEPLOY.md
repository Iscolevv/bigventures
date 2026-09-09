# Deploying the dashboard to Vercel

The dashboard (`apps/dashboard`) is a Next.js 16 app in a pnpm monorepo. It
serves both the management UI and the mobile API.

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

- Set `BETTER_AUTH_URL` to the real domain and redeploy.
- The mobile app's `EXPO_PUBLIC_API_BASE_URL` should point at this same URL.

## Migrations on future schema changes

```bash
pnpm db:generate      # creates the next drizzle/NNNN_*.sql
pnpm db:migrate       # applies it to the bigventures schema
```

Never run `drizzle-kit push` against this database — it's shared with Moody
Treats. `schemaFilter: ['bigventures']` protects `public`, but migrations are
the safe path.
