/**
 * Trip GPS trail + geofence detection.
 *
 * While a trip is `in_progress` we run a foreground-service location task that:
 *   - buffers trail points into the local `trail_segments` table (flushed in
 *     ~50-point chunks so sync payloads stay small), and
 *   - checks each fix against the active trip's loading point and every pending
 *     drop's geofence, stamping arrival times and nudging drop status.
 *
 * Battery: `Balanced` accuracy + a 40 m distance filter + 15 s interval is
 * enough for route reconstruction without hammering the GPS.
 */
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import * as Crypto from 'expo-crypto';
import { isInsideGeofence, DEFAULT_GEOFENCE_RADIUS_M, type LatLng } from '@bv/core/geo';
import { db, getMeta, setMeta } from './localdb';
import { SYNC } from './config';

export const TRAIL_TASK = 'bv-trail-task';

const buffer: Array<LatLng & { t: number; speedKph?: number; accuracyM?: number }> = [];

TaskManager.defineTask(TRAIL_TASK, async ({ data, error }) => {
  if (error) return;
  const { locations } = (data ?? {}) as { locations?: Location.LocationObject[] };
  const activeTrip = getMeta('activeTripClientId');
  if (!activeTrip || !locations?.length) return;

  for (const loc of locations) {
    const pt = {
      lat: loc.coords.latitude,
      lng: loc.coords.longitude,
      t: loc.timestamp,
      speedKph: loc.coords.speed != null ? Math.max(0, loc.coords.speed * 3.6) : undefined,
      accuracyM: loc.coords.accuracy ?? undefined,
    };
    buffer.push(pt);
    checkGeofences(activeTrip, pt);
  }

  if (buffer.length >= 50) flushTrail(activeTrip);
});

function flushTrail(tripClientId: string) {
  if (!buffer.length) return;
  const points = buffer.splice(0, buffer.length);
  db().runSync(
    "INSERT INTO trail_segments (client_id, trip_client_id, points_json, sync_state) VALUES (?, ?, ?, 'dirty')",
    [Crypto.randomUUID(), tripClientId, JSON.stringify(points)],
  );
}

function checkGeofences(tripClientId: string, pt: LatLng) {
  const d = db();
  const trip = d.getFirstSync<{ loading_lat: number; loading_lng: number; status: string }>(
    'SELECT loading_lat, loading_lng, status FROM trips WHERE client_id = ?',
    [tripClientId],
  );
  if (trip?.loading_lat != null && getMeta(`loadingArrived:${tripClientId}`) !== '1') {
    if (isInsideGeofence(pt, { center: { lat: trip.loading_lat, lng: trip.loading_lng }, radiusM: DEFAULT_GEOFENCE_RADIUS_M.loading })) {
      setMeta(`loadingArrived:${tripClientId}`, '1');
    }
  }

  const drops = d.getAllSync<{ client_id: string; dest_lat: number; dest_lng: number; geofence_radius_m: number; status: string }>(
    "SELECT client_id, dest_lat, dest_lng, geofence_radius_m, status FROM drops WHERE trip_client_id = ? AND status IN ('pending','arrived') AND dest_lat IS NOT NULL",
    [tripClientId],
  );
  for (const drop of drops) {
    const inside = isInsideGeofence(pt, {
      center: { lat: drop.dest_lat, lng: drop.dest_lng },
      radiusM: drop.geofence_radius_m || DEFAULT_GEOFENCE_RADIUS_M.drop,
    });
    if (inside && drop.status === 'pending') {
      d.runSync(
        "UPDATE drops SET status = 'arrived', arrived_at = COALESCE(arrived_at, ?), geofence_entered_at = COALESCE(geofence_entered_at, ?), sync_state = 'dirty', updated_at = ? WHERE client_id = ?",
        [new Date().toISOString(), new Date().toISOString(), new Date().toISOString(), drop.client_id],
      );
    }
  }
}

export async function startTrailTracking(tripClientId: string) {
  const fg = await Location.requestForegroundPermissionsAsync();
  if (!fg.granted) throw new Error('Location permission is required to start a trip.');
  await Location.requestBackgroundPermissionsAsync();

  setMeta('activeTripClientId', tripClientId);
  const already = await Location.hasStartedLocationUpdatesAsync(TRAIL_TASK).catch(() => false);
  if (already) return;

  await Location.startLocationUpdatesAsync(TRAIL_TASK, {
    accuracy: Location.Accuracy.Balanced,
    timeInterval: SYNC.trailIntervalMs,
    distanceInterval: SYNC.trailDistanceM,
    showsBackgroundLocationIndicator: true,
    pausesUpdatesAutomatically: false,
    foregroundService: {
      notificationTitle: 'Big Ventures — trip in progress',
      notificationBody: 'Recording your route and delivery stops',
    },
  });
}

export async function stopTrailTracking(tripClientId: string) {
  flushTrail(tripClientId);
  setMeta('activeTripClientId', '');
  const running = await Location.hasStartedLocationUpdatesAsync(TRAIL_TASK).catch(() => false);
  if (running) await Location.stopLocationUpdatesAsync(TRAIL_TASK);
}
