# APIs & services to get Big Ventures fully running

Two are already done. Two more get you 100 %.

| # | Service | Status | What it powers | Cost |
|---|---|---|---|---|
| 1 | **Neon Postgres** | ✅ done (shared with Moody Treats, `bigventures` schema) | all data | on the existing plan |
| 2 | **Better Auth** | ✅ done (`BETTER_AUTH_SECRET` set on Vercel) | sign-in, RBAC | free |
| 3 | **Vercel Blob** | ✅ done - verified end-to-end (upload → URL → retrievable) | document / POD / receipt uploads | free tier: 1 GB storage, 10 GB bandwidth/mo |
| 4 | **Google Maps Platform** | ⏸ paused for phase 1 (integration removed from the app) | would power planned route + geocoding, later | n/a |
| - | **CRON_SECRET** | ⬜ optional, 30 sec | locks the nightly job endpoint | free |

Check any time (signed in as admin): **`/api/health`**.

---

## 3. Vercel Blob (do this first - unblocks all file uploads)

1. Vercel → your **bigventures** project → **Storage** tab → **Create Database** → **Blob** → name it `bigventures-files` → Create.
2. Vercel connects it to the project automatically and injects `BLOB_READ_WRITE_TOKEN` into every environment.
3. **Redeploy** (Deployments → ⋯ → Redeploy) so the running app picks up the token.

That's it. `/documents` → "Upload document" now works, and the driver app's POD photos / fuel receipts / document uploads land in Blob.

> Prefer Cloudflare R2 (cheaper at photo scale, no egress fees)? Set `R2_ENDPOINT`, `R2_BUCKET`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` instead - the storage layer auto-detects and uses R2 when those are present. Blob is the faster start.

## 4. Google Maps Platform (paused - not part of phase 1)

Phase 1 is deliberately basics-first: get drivers and Kevin off manual data
entry before adding anything that costs money or needs Google Cloud billing.
The Directions/Geocoding integration (planned route, address → coordinates,
the "Compute planned route" button) has been removed from the app for now -
the trip map still works fine without it, drawing the actual GPS trail and
drop markers.

To bring it back in a later phase: enable billing on a Google Cloud project,
turn on the Directions and Geocoding APIs, create a restricted API key, and
re-wire `lib/maps.ts` (see git history for the removed version) behind a
`GOOGLE_MAPS_SERVER_KEY` env var.

## CRON_SECRET (optional - 10 seconds)

The nightly job (`/api/cron/nightly`: refresh doc statuses, balances, run the alert scan) is currently open. To lock it:

```
CRON_SECRET = <any long random string, e.g. openssl rand -hex 24>
```

Add it in Vercel env vars. Vercel Cron automatically sends `Authorization: Bearer <CRON_SECRET>`, so the schedule keeps working and manual calls without the header get 401.

---

## After adding env vars

Redeploy (Vercel does this automatically on the next git push, or trigger it manually). No migration or reseed needed.
