/**
 * Google Maps Platform — Directions + Geocoding, server side.
 *
 * Every function no-ops (returns null) when `GOOGLE_MAPS_SERVER_KEY` is unset,
 * so the app runs fine without Maps; you just don't get the planned route line
 * or address → coordinate resolution.
 */
const KEY = process.env.GOOGLE_MAPS_SERVER_KEY;
export const mapsEnabled = () => !!KEY;

export interface LatLng {
  lat: number;
  lng: number;
}

export interface GeocodeResult extends LatLng {
  formattedAddress: string;
}

/** Last Google API status seen — used to surface real errors to the UI. */
export let lastMapsError: string | null = null;

function note(api: string, status: string, message?: string) {
  lastMapsError = `${api}: ${status}${message ? ` — ${message}` : ''}`;
  if (status !== 'OK' && status !== 'ZERO_RESULTS') console.error('[maps]', lastMapsError);
}

/** Address string → coordinates. Biased to Kenya. */
export async function geocode(address: string): Promise<GeocodeResult | null> {
  if (!KEY || !address.trim()) return null;
  const url = new URL('https://maps.googleapis.com/maps/api/geocode/json');
  url.searchParams.set('address', address);
  url.searchParams.set('region', 'ke');
  url.searchParams.set('components', 'country:KE');
  url.searchParams.set('key', KEY);
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(6000) });
    const data = (await res.json()) as {
      status: string;
      error_message?: string;
      results?: { geometry: { location: LatLng }; formatted_address: string }[];
    };
    note('Geocoding', data.status, data.error_message);
    const hit = data.results?.[0];
    if (data.status !== 'OK' || !hit) return null;
    return {
      lat: hit.geometry.location.lat,
      lng: hit.geometry.location.lng,
      formattedAddress: hit.formatted_address,
    };
  } catch (e) {
    note('Geocoding', 'FETCH_FAILED', e instanceof Error ? e.message : String(e));
    return null;
  }
}

export interface RouteResult {
  polyline: string;
  distanceM: number;
  durationS: number;
}

export async function directions(
  origin: LatLng,
  destination: LatLng,
  waypoints: LatLng[] = [],
): Promise<RouteResult | null> {
  if (!KEY) return null;
  const ll = (p: LatLng) => `${p.lat},${p.lng}`;
  const url = new URL('https://maps.googleapis.com/maps/api/directions/json');
  url.searchParams.set('origin', ll(origin));
  url.searchParams.set('destination', ll(destination));
  if (waypoints.length) url.searchParams.set('waypoints', waypoints.map(ll).join('|'));
  url.searchParams.set('mode', 'driving');
  url.searchParams.set('region', 'ke');
  url.searchParams.set('key', KEY);
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    const data = (await res.json()) as {
      status: string;
      error_message?: string;
      routes?: {
        overview_polyline: { points: string };
        legs: { distance: { value: number }; duration: { value: number } }[];
      }[];
    };
    note('Directions', data.status, data.error_message);
    const route = data.routes?.[0];
    if (data.status !== 'OK' || !route) return null;
    return {
      polyline: route.overview_polyline.points,
      distanceM: route.legs.reduce((s, l) => s + l.distance.value, 0),
      durationS: route.legs.reduce((s, l) => s + l.duration.value, 0),
    };
  } catch (e) {
    note('Directions', 'FETCH_FAILED', e instanceof Error ? e.message : String(e));
    return null;
  }
}
