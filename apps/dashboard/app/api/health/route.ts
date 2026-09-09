import { NextResponse } from 'next/server';
import { db, sql } from '@bv/db';
import { getSessionUser } from '@/lib/session';
import { storageBackend } from '@/lib/storage';
import { mapsEnabled, geocode, directions, lastMapsError } from '@/lib/maps';

export const dynamic = 'force-dynamic';

/**
 * Config + connectivity check. Basic status is public; the detail view
 * (which services are wired) needs an admin/ops session.
 * Add `?maps=1` (admin) to run a live Geocoding + Directions test call.
 */
export async function GET(req: Request) {
  const user = await getSessionUser();
  const privileged = user && (user.role === 'admin' || user.role === 'operations');

  let dbOk = false;
  try {
    await db.execute(sql`select 1`);
    dbOk = true;
  } catch {
    dbOk = false;
  }

  const base = { ok: dbOk, time: new Date().toISOString() };
  if (!privileged) return NextResponse.json(base);

  const out: Record<string, unknown> = {
    ...base,
    database: dbOk ? 'connected (bigventures schema)' : 'ERROR',
    fileStorage: storageBackend(),
    googleMaps: mapsEnabled() ? 'key set' : 'no key',
    cronSecret: process.env.CRON_SECRET ? 'set (nightly job locked)' : 'not set (nightly job open)',
    betterAuthUrl: process.env.BETTER_AUTH_URL ?? '(auto from Vercel)',
  };

  if (new URL(req.url).searchParams.get('maps') === '1' && mapsEnabled()) {
    const g = await geocode('Karen, Nairobi');
    const gStatus = lastMapsError;
    let dStatus: string | null = null;
    let dOk = false;
    if (g) {
      const r = await directions({ lat: -1.286, lng: 36.817 }, { lat: g.lat, lng: g.lng });
      dOk = !!r;
      dStatus = lastMapsError;
    }
    out.mapsTest = {
      geocode: g ? `OK (${g.formattedAddress})` : `FAILED — ${gStatus}`,
      directions: dOk ? 'OK' : `FAILED — ${dStatus ?? 'geocode failed first'}`,
    };
  }

  return NextResponse.json(out);
}
