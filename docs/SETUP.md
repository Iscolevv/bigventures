# APIs & services to get Big Ventures fully running

Two are already done. Two more get you 100 %.

| # | Service | Status | What it powers | Cost |
|---|---|---|---|---|
| 1 | **Neon Postgres** | ✅ done (shared with Moody Treats, `bigventures` schema) | all data | on the existing plan |
| 2 | **Better Auth** | ✅ done (`BETTER_AUTH_SECRET` set on Vercel) | sign-in, RBAC | free |
| 3 | **Vercel Blob** | ✅ done — verified end-to-end (upload → URL → retrievable) | document / POD / receipt uploads | free tier: 1 GB storage, 10 GB bandwidth/mo |
| 4 | **Google Maps Platform** | ✅ done (`GOOGLE_MAPS_SERVER_KEY` set) | planned route on trip sync, address → coordinates | ~$0 at this volume ($200/mo free credit) |
| — | **CRON_SECRET** | ⬜ optional, 30 sec | locks the nightly job endpoint | free |

Check any time (signed in as admin): **`/api/health`**.

---

## 3. Vercel Blob (do this first — unblocks all file uploads)

1. Vercel → your **bigventures** project → **Storage** tab → **Create Database** → **Blob** → name it `bigventures-files` → Create.
2. Vercel connects it to the project automatically and injects `BLOB_READ_WRITE_TOKEN` into every environment.
3. **Redeploy** (Deployments → ⋯ → Redeploy) so the running app picks up the token.

That's it. `/documents` → "Upload document" now works, and the driver app's POD photos / fuel receipts / document uploads land in Blob.

> Prefer Cloudflare R2 (cheaper at photo scale, no egress fees)? Set `R2_ENDPOINT`, `R2_BUCKET`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` instead — the storage layer auto-detects and uses R2 when those are present. Blob is the faster start.

## 4. Google Maps Platform (optional — planned routes + geocoding)

Wired and ready — the code no-ops until the key is set, then:
- every trip synced from the app gets a **planned route** (encoded polyline +
  distance + duration) from Directions, shown dashed on the trip map next to
  the actual GPS trail;
- drops/loading points that came in **address-only** (driver didn't drop a pin)
  get **geocoded** to coordinates;
- trip detail gets a **"Compute planned route"** button to (re)run it for
  existing trips.

The dashboard's trip map already works without Maps (it draws the actual GPS
trail); this just adds the planned line and address resolution.

1. https://console.cloud.google.com → create a project (e.g. `big-ventures`).
2. Enable billing (required; you stay inside the $200/mo free credit at this fleet size).
3. **APIs & Services → Enable APIs** → enable **Directions API** and **Geocoding API**.
   (For the mobile map basemap later: also **Maps SDK for Android**.)
4. **Credentials → Create credentials → API key**. Restrict it to those APIs.
5. Add to Vercel env vars:
   - `GOOGLE_MAPS_SERVER_KEY` = the key
   - `EXPO_PUBLIC_GOOGLE_MAPS_ANDROID_KEY` = same key (or a separate Android-restricted one) — used by the mobile app.

## CRON_SECRET (optional — 10 seconds)

The nightly job (`/api/cron/nightly`: refresh doc statuses, balances, run the alert scan) is currently open. To lock it:

```
CRON_SECRET = <any long random string, e.g. openssl rand -hex 24>
```

Add it in Vercel env vars. Vercel Cron automatically sends `Authorization: Bearer <CRON_SECRET>`, so the schedule keeps working and manual calls without the header get 401.

---

## After adding env vars

Redeploy (Vercel does this automatically on the next git push, or trigger it manually). No migration or reseed needed.
