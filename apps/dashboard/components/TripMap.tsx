import { decodePolyline, boundingBox, type LatLng } from '@bv/core/geo';

/**
 * Keyless SVG mini-map: planned route (from the encoded polyline), the actual
 * GPS trail, and loading + drop markers, all fitted to a bounding box. No tile
 * server, so it renders offline / before a Maps key is configured. Swap for a
 * Google Maps embed once `GOOGLE_MAPS_SERVER_KEY` is set if you want basemaps.
 */
export function TripMap({
  planned,
  trail,
  loading,
  drops,
  height = 320,
}: {
  planned?: string | null;
  trail: LatLng[];
  loading?: LatLng | null;
  drops: (LatLng & { sequence: number; failed?: boolean })[];
  height?: number;
}) {
  const plannedPts = planned ? decodePolyline(planned) : [];
  const all: LatLng[] = [
    ...plannedPts,
    ...trail,
    ...(loading ? [loading] : []),
    ...drops,
  ].filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng));

  if (all.length === 0) {
    return (
      <div className="grid place-items-center rounded-xl border bg-surface text-sm text-muted" style={{ height }}>
        No location data for this trip
      </div>
    );
  }

  const bb = boundingBox(all, 300)!;
  const W = 900;
  const H = height;
  const pad = 16;
  const spanLat = bb.maxLat - bb.minLat || 0.001;
  const spanLng = bb.maxLng - bb.minLng || 0.001;
  const x = (p: LatLng) => pad + ((p.lng - bb.minLng) / spanLng) * (W - 2 * pad);
  const y = (p: LatLng) => pad + (1 - (p.lat - bb.minLat) / spanLat) * (H - 2 * pad);
  const path = (pts: LatLng[]) =>
    pts.length < 2 ? '' : pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(p).toFixed(1)},${y(p).toFixed(1)}`).join(' ');

  return (
    <div className="overflow-hidden rounded-xl border bg-surface">
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} role="img" aria-label="Trip route map">
        <rect width={W} height={H} fill="var(--bg)" />
        {plannedPts.length > 1 && (
          <path d={path(plannedPts)} fill="none" stroke="var(--muted)" strokeWidth={3} strokeDasharray="6 5" opacity={0.7} />
        )}
        {trail.length > 1 && <path d={path(trail)} fill="none" stroke="var(--brand)" strokeWidth={3} />}
        {loading && (
          <g>
            <circle cx={x(loading)} cy={y(loading)} r={7} fill="var(--fg)" />
            <text x={x(loading) + 11} y={y(loading) + 4} fontSize={12} fill="var(--fg)">
              Loading
            </text>
          </g>
        )}
        {drops.map((d) => (
          <g key={d.sequence}>
            <circle cx={x(d)} cy={y(d)} r={9} fill={d.failed ? 'var(--crit)' : 'var(--brand)'} />
            <text x={x(d)} y={y(d) + 4} fontSize={11} fill="#fff" textAnchor="middle">
              {d.sequence}
            </text>
          </g>
        ))}
      </svg>
      <div className="flex gap-4 border-t px-4 py-2 text-xs text-muted">
        <span>— actual trail</span>
        <span>-- planned route</span>
        <span>● drop</span>
      </div>
    </div>
  );
}
