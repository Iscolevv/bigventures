# The driver app (web)

There is **nothing to install from the Play Store / App Store**. It's a web
app: the driver opens a link, signs in, and adds it to their home screen so it
behaves exactly like a normal app (own icon, full screen, no browser bar).

## Installing on a phone (one time, ~1 minute)

1. Open **https://venturesbig.vercel.app** in the phone's browser
   (**Chrome** on Android, **Safari** on iPhone).
2. Sign in with the email + password the office gave that driver
   (each driver has their own — created in the dashboard under Drivers).
3. Add it to the home screen:
   - **Android / Chrome** — a blue **"Install app"** banner appears at the top;
     tap it. (Or menu **⋮ → Add to Home screen / Install app**.)
   - **iPhone / Safari** — tap the **Share** button (□↑) at the bottom, then
     **Add to Home Screen → Add**.
4. Open it from the new **Big Ventures** icon on the home screen. First time,
   tap **Allow** when it asks for **Location** and **Camera** — both are
   required (GPS pins + route, delivery photos).

That's it — it now opens full screen like any app and remembers the login.
Updates are automatic (no re-install ever).

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
