# The driver app (web)

Drivers use **https://venturesbig.vercel.app** on their phone browser — no
install. After they sign in they land on **`/d`** (office users can't reach it;
drivers can't reach the dashboard).

## First time on a phone

1. Open the site in Chrome (Android) or Safari (iPhone).
2. Sign in with the driver's email + password.
3. **Add to Home screen** (browser menu) — it then opens full-screen like an app.
4. Allow **Location** and **Camera** when prompted (needed for pins + proof of delivery).

## The flow

| Step | Screen |
|---|---|
| Start of day | `/d` → **Start a trip** → pick vehicle + loading point (tap **Pin where I'm loading**) |
| Before driving | **Vehicle check** — pass/fail each item; a failed *critical* item holds the trip for the office |
| Add stops | **+ Add / edit** on the trip → address + optional GPS pin (Maps fills coordinates from the address if the key is set) |
| Leave the yard | **Start driving** — the trip starts recording your route while the screen is on |
| At each stop | Tap the drop → it marks you "arrived" from GPS → **+ Photo** (camera only) → who received it → **Delivered / Partial / Failed** |
| Fuel | **Log fuel** on the trip → litres, total, odometer, receipt photo |
| End of day | Enter closing odometer → **Finish trip** (only once every drop is closed) |
| Anytime | **My docs** → photograph licence / good conduct / NSSF / SHIF for the office to review |

## What the office sees immediately

Every action lands in the dashboard in real time — trip on the Trips list,
drops with photos and GPS on the trip detail, fuel on the Fuel view, the route
trail on the trip map, and any failed check / delivery issue in the Alerts
panel.

## Limits vs the native app

The route trail only records while the trip screen is **open and the phone is
unlocked** — web browsers pause GPS in the background. On long hauls, keep the
screen on, or the office reconstructs the route from your drop arrivals. The
native Android app (`apps/mobile`, built and ready to publish) does true
background tracking and full offline queueing if that becomes necessary.

## Demo logins

`<firstname>.<lastname>@bigventures.demo` / `driver1234` — e.g.
`nahashon.gitau@bigventures.demo`. (Re-run
`node --env-file=../../.env --import tsx apps/dashboard/scripts/seed-driver-logins.ts`
after a reseed.)
