'use server';
import { revalidatePath } from 'next/cache';
import { requirePermission } from '@/lib/session';
import { db, schema, eq } from '@bv/db';
import { mapsEnabled, geocode, directions, lastMapsError } from '@/lib/maps';

/**
 * Compute (or refresh) the planned route for one trip using Google Directions.
 * Geocodes the loading point and any drop that has no coordinates first.
 */
export async function recomputeRoute(tripId: string) {
  await requirePermission('trip:update');
  if (!mapsEnabled()) {
    return { error: 'Google Maps key not set — add GOOGLE_MAPS_SERVER_KEY (see docs/SETUP.md).' };
  }

  const [trip] = await db
    .select()
    .from(schema.trips)
    .where(eq(schema.trips.id, tripId))
    .limit(1);
  if (!trip) return { error: 'Trip not found' };

  let origin =
    trip.loading_lat != null && trip.loading_lng != null
      ? { lat: trip.loading_lat, lng: trip.loading_lng }
      : null;
  if (!origin && trip.loading_point_address) {
    const g = await geocode(trip.loading_point_address);
    if (g) {
      origin = { lat: g.lat, lng: g.lng };
      await db.update(schema.trips).set({ loading_lat: g.lat, loading_lng: g.lng }).where(eq(schema.trips.id, tripId));
    }
  }
  if (!origin) return { error: 'Could not resolve the loading point' };

  const drops = await db
    .select()
    .from(schema.drops)
    .where(eq(schema.drops.trip_id, tripId))
    .orderBy(schema.drops.sequence);

  const points: { lat: number; lng: number }[] = [];
  for (const d of drops) {
    if (d.dest_lat != null && d.dest_lng != null) {
      points.push({ lat: d.dest_lat, lng: d.dest_lng });
    } else {
      const g = await geocode(d.destination_address);
      if (g) {
        points.push({ lat: g.lat, lng: g.lng });
        await db.update(schema.drops).set({ dest_lat: g.lat, dest_lng: g.lng }).where(eq(schema.drops.id, d.id));
      }
    }
  }
  if (points.length === 0) {
    return { error: `Could not resolve drop coordinates${lastMapsError ? ` (${lastMapsError})` : ''}` };
  }

  const route = await directions(origin, points[points.length - 1]!, points.slice(0, -1));
  if (!route) {
    return { error: lastMapsError ? `Directions failed — ${lastMapsError}` : 'Directions API returned no route' };
  }

  await db
    .update(schema.trips)
    .set({
      planned_polyline: route.polyline,
      planned_distance_m: route.distanceM,
      planned_duration_s: route.durationS,
    })
    .where(eq(schema.trips.id, tripId));

  revalidatePath(`/trips/${tripId}`);
  return { ok: true, distanceKm: Math.round(route.distanceM / 100) / 10 };
}
