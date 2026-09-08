/**
 * Geospatial helpers shared by the mobile app (live geofencing) and the
 * backend (re-validating what the device reported, deviation analytics).
 *
 * Everything is plain trig on WGS-84 lat/lng — no PostGIS dependency. Good to
 * a few metres at delivery-run distances, which is all we need for geofences.
 */

export interface LatLng {
  lat: number;
  lng: number;
}

export interface TrailPoint extends LatLng {
  /** epoch ms */
  t: number;
  speedKph?: number;
  headingDeg?: number;
  accuracyM?: number;
}

const EARTH_RADIUS_M = 6_371_008.8;
const toRad = (d: number) => (d * Math.PI) / 180;

/** Great-circle distance in metres. */
export function haversineMeters(a: LatLng, b: LatLng): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

export interface Geofence {
  center: LatLng;
  radiusM: number;
}

export function isInsideGeofence(point: LatLng, fence: Geofence): boolean {
  return haversineMeters(point, fence.center) <= fence.radiusM;
}

/**
 * Default geofence radii (metres). Loading points are usually large yards;
 * drop points range from a shopfront to a distributor warehouse.
 */
export const DEFAULT_GEOFENCE_RADIUS_M = {
  loading: 150,
  drop: 120,
} as const;

/** Total path length of a GPS trail, in metres. */
export function trailDistanceMeters(points: readonly LatLng[]): number {
  let sum = 0;
  for (let i = 1; i < points.length; i++) {
    sum += haversineMeters(points[i - 1]!, points[i]!);
  }
  return sum;
}

/** Perpendicular-ish distance from a point to a polyline (min vertex-segment distance, metres). */
export function distanceToPathMeters(point: LatLng, path: readonly LatLng[]): number {
  if (path.length === 0) return Infinity;
  if (path.length === 1) return haversineMeters(point, path[0]!);
  let min = Infinity;
  for (let i = 1; i < path.length; i++) {
    min = Math.min(min, pointToSegmentMeters(point, path[i - 1]!, path[i]!));
  }
  return min;
}

function pointToSegmentMeters(p: LatLng, a: LatLng, b: LatLng): number {
  // Project into a local equirectangular plane centred on `a`; fine for short segments.
  const mPerDegLat = 111_320;
  const mPerDegLng = 111_320 * Math.cos(toRad(a.lat));
  const ax = 0;
  const ay = 0;
  const bx = (b.lng - a.lng) * mPerDegLng;
  const by = (b.lat - a.lat) * mPerDegLat;
  const px = (p.lng - a.lng) * mPerDegLng;
  const py = (p.lat - a.lat) * mPerDegLat;
  const dx = bx - ax;
  const dy = by - ay;
  const lenSq = dx * dx + dy * dy;
  const t = lenSq === 0 ? 0 : Math.max(0, Math.min(1, (px * dx + py * dy) / lenSq));
  const cx = ax + t * dx;
  const cy = ay + t * dy;
  return Math.hypot(px - cx, py - cy);
}

export interface DeviationCheck {
  offRoute: boolean;
  distanceFromRouteM: number;
  thresholdM: number;
}

/**
 * Is `point` more than `thresholdM` off the planned route line?
 * Threshold scales a little with the reported GPS accuracy so a noisy fix
 * near the edge doesn't raise a false deviation.
 */
export function checkDeviation(
  point: LatLng & { accuracyM?: number },
  plannedPath: readonly LatLng[],
  baseThresholdM = 300,
): DeviationCheck {
  const thresholdM = baseThresholdM + Math.min(point.accuracyM ?? 0, 150);
  const distanceFromRouteM = distanceToPathMeters(point, plannedPath);
  return { offRoute: distanceFromRouteM > thresholdM, distanceFromRouteM, thresholdM };
}

/** Bounding box of a set of points, padded by `padM` metres. */
export function boundingBox(points: readonly LatLng[], padM = 0) {
  if (points.length === 0) return null;
  let minLat = Infinity;
  let maxLat = -Infinity;
  let minLng = Infinity;
  let maxLng = -Infinity;
  for (const p of points) {
    minLat = Math.min(minLat, p.lat);
    maxLat = Math.max(maxLat, p.lat);
    minLng = Math.min(minLng, p.lng);
    maxLng = Math.max(maxLng, p.lng);
  }
  const dLat = padM / 111_320;
  const dLng = padM / (111_320 * Math.cos(toRad((minLat + maxLat) / 2)));
  return {
    minLat: minLat - dLat,
    maxLat: maxLat + dLat,
    minLng: minLng - dLng,
    maxLng: maxLng + dLng,
  };
}

/**
 * Decode a Google/OSRM encoded polyline into points.
 * Precision 5 = Google Directions default, 6 = OSRM/Valhalla default.
 */
export function decodePolyline(encoded: string, precision = 5): LatLng[] {
  const factor = 10 ** precision;
  const points: LatLng[] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;
  while (index < encoded.length) {
    let result = 1;
    let shift = 0;
    let b: number;
    do {
      b = encoded.charCodeAt(index++) - 63 - 1;
      result += b << shift;
      shift += 5;
    } while (b >= 0x1f);
    lat += result & 1 ? ~(result >> 1) : result >> 1;

    result = 1;
    shift = 0;
    do {
      b = encoded.charCodeAt(index++) - 63 - 1;
      result += b << shift;
      shift += 5;
    } while (b >= 0x1f);
    lng += result & 1 ? ~(result >> 1) : result >> 1;

    points.push({ lat: lat / factor, lng: lng / factor });
  }
  return points;
}

/**
 * Stable key for grouping "the same route" across trips: origin + ordered
 * destinations, each snapped to a ~550 m grid (3 decimal places). Used by the
 * route-cost analytics view so historical trips between the same yard and the
 * same customers roll up together even when the typed address differs slightly.
 */
export function routeKey(origin: LatLng, destinations: readonly LatLng[]): string {
  const snap = (p: LatLng) => `${p.lat.toFixed(3)},${p.lng.toFixed(3)}`;
  return [snap(origin), ...destinations.map(snap)].join('|');
}
