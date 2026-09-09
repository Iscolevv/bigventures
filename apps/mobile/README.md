# Big Ventures Driver (Expo / Android)

Offline-first driver app. Every screen reads/writes local SQLite; a background
loop (`src/lib/sync.ts`) reconciles with `venturesbig.vercel.app` when online.

## Dev

```bash
pnpm install                      # from repo root
cd apps/mobile
cp ../../.env.example .env         # EXPO_PUBLIC_API_BASE_URL, EXPO_PUBLIC_GOOGLE_MAPS_ANDROID_KEY
pnpm start                         # Expo dev client
```

You need a **dev client** build (not Expo Go) because the app uses
`expo-sqlite`, background `expo-location`, and `expo-secure-store`:

```bash
npx expo run:android              # local build to a connected device/emulator
# or, cloud build:
npx eas build --profile development --platform android
```

## Ship an APK / Play Store internal track

```bash
npx eas build --profile preview --platform android      # installable APK
npx eas build --profile production --platform android    # AAB for Play Console
```

Set `EXPO_PUBLIC_API_BASE_URL=https://venturesbig.vercel.app` and the Maps key
in EAS project secrets first.

## Screens

| Route | |
|---|---|
| `index` | email/password sign-in (same Better Auth backend as the dashboard) |
| `(driver)/index` | trip list, pull-to-sync, link to My documents |
| `(driver)/new-trip` | create a trip (vehicle + loading point) |
| `(driver)/trip/[id]` | trip detail — gates start on check + ≥1 drop, close on all drops done |
| `(driver)/check/[tripId]` | pre-trip vehicle check (blocking items hold the trip for ops) |
| `(driver)/add-drop/[tripId]` | add a drop, optional GPS pin |
| `(driver)/drop/[id]` | deliver: camera-only POD, signee, issue category |
| `(driver)/fuel/[tripId]` | fuel entry with receipt photo |
| `(driver)/documents` | upload licence / good conduct / NSSF / SHIF for review |

Trip GPS trail + geofence arrival detection runs as an Android foreground
service while a trip is `in_progress` (`src/lib/location.ts`).
