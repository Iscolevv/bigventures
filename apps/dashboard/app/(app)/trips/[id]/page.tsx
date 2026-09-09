import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requirePermission, can } from '@/lib/session';
import { db } from '@bv/db';
import * as q from '@bv/db/queries';
import { PageHeader, Card, Badge, StatTile, kes, dateTime, type Column, DataTable } from '@/components/ui';
import { TripMap } from '@/components/TripMap';
import { RouteButton } from '@/components/RouteButton';

export const dynamic = 'force-dynamic';

const DROP_TONE: Record<string, 'ok' | 'warn' | 'crit' | 'muted'> = {
  delivered: 'ok',
  partial: 'warn',
  failed: 'crit',
  returned: 'crit',
  pending: 'muted',
  arrived: 'muted',
};

export default async function TripDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePermission('trip:read');
  const { id } = await params;
  const detail = await q.tripDetail(db, id);
  if (!detail) notFound();

  const { trip, drops, checks, trail, deviations, fuel, costs } = detail;
  const fuelTotal = fuel.reduce((s, f) => s + f.totalCost, 0);
  const costTotal = costs.reduce((s, c) => s + c.amount, 0);

  const dropCols: Column<(typeof drops)[number]>[] = [
    { key: 'seq', header: '#', render: (d) => d.sequence },
    { key: 'addr', header: 'Destination', render: (d) => <span className="font-medium">{d.address}</span> },
    { key: 'status', header: 'Status', render: (d) => <Badge tone={DROP_TONE[d.status] ?? 'muted'}>{d.status}</Badge> },
    { key: 'signee', header: 'Received by', render: (d) => <span className="text-muted">{d.signee ?? '—'}</span> },
    { key: 'pod', header: 'POD', align: 'center', render: (d) => (d.photos > 0 ? `${d.photos}📷` : d.status === 'delivered' ? <span className="text-crit">missing</span> : '—') },
    { key: 'arr', header: 'Arrived', render: (d) => <span className="text-muted">{dateTime(d.arrivedAt)}</span> },
    { key: 'geo', header: 'Geofence', align: 'center', render: (d) => (d.geofenceSkipped ? <Badge tone="warn">skipped</Badge> : d.geofenceEnteredAt ? '✓' : '—') },
    { key: 'issue', header: 'Issue', render: (d) => (d.issueCategory ? <Badge tone="crit">{d.issueCategory}</Badge> : '') },
  ];

  return (
    <>
      <PageHeader
        title={trip.ref}
        subtitle={`${trip.vehicle} · ${trip.driver}${trip.route ? ` · ${trip.route}` : ''}`}
        actions={
          <Link href="/trips" className="rounded-md border px-3 py-1.5 text-sm hover:bg-bg">
            ← All trips
          </Link>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Badge tone={trip.status === 'flagged' ? 'crit' : trip.status === 'completed' ? 'ok' : 'brand'}>
          {trip.status.replace('_', ' ')}
        </Badge>
        {deviations.length > 0 && <Badge tone="warn">{deviations.length} deviation(s)</Badge>}
        {checks[0] && <Badge tone={checks[0].result === 'pass' ? 'ok' : 'warn'}>check: {checks[0].result}</Badge>}
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Planned distance" value={trip.plannedDistanceKm ? `${trip.plannedDistanceKm.toFixed(0)} km` : '—'} />
        <StatTile label="Odometer distance" value={trip.odometerKm > 0 ? `${trip.odometerKm.toFixed(0)} km` : '—'} />
        <StatTile label="Fuel" value={kes(fuelTotal)} />
        <StatTile label="Other costs" value={kes(costTotal)} />
      </div>

      <div className="mb-2 mt-6 flex items-center justify-between">
        <h2 className="text-sm font-semibold">Route</h2>
        {can(user.role, 'trip:update') && <RouteButton tripId={trip.id} />}
      </div>
      <div>
        <TripMap
          planned={trip.plannedPolyline}
          trail={trail}
          loading={trip.loadingLat != null ? { lat: trip.loadingLat, lng: trip.loadingLng! } : null}
          drops={drops
            .filter((d) => d.lat != null)
            .map((d) => ({ lat: d.lat!, lng: d.lng!, sequence: d.sequence, failed: d.issueCategory != null }))}
        />
      </div>

      <h2 className="mb-2 mt-6 text-sm font-semibold">Drops</h2>
      <DataTable columns={dropCols} rows={drops} />

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card title="Vehicle check">
          {checks[0] ? (
            <ul className="space-y-1 text-sm">
              {checks[0].items.map((it) => (
                <li key={it.key} className="flex justify-between">
                  <span className="capitalize">{it.key.replace(/_/g, ' ')}</span>
                  <span className={it.result === 'fail' ? 'text-crit' : it.result === 'pass' ? 'text-ok' : 'text-muted'}>
                    {it.result}
                    {it.value ? ` (${it.value})` : ''}
                  </span>
                </li>
              ))}
              {checks[0].items.length === 0 && <li className="text-muted">No item detail</li>}
            </ul>
          ) : (
            <p className="text-sm text-muted">No vehicle check recorded for this trip.</p>
          )}
        </Card>

        <Card title="Fuel & costs">
          {fuel.length === 0 && costs.length === 0 ? (
            <p className="text-sm text-muted">Nothing logged.</p>
          ) : (
            <ul className="space-y-1.5 text-sm">
              {fuel.map((f) => (
                <li key={f.id} className="flex justify-between">
                  <span>{f.litres} L — {f.station ?? 'fuel'}</span>
                  <span className="tabular-nums">{kes(f.totalCost)}</span>
                </li>
              ))}
              {costs.map((c) => (
                <li key={c.id} className="flex justify-between">
                  <span className="capitalize">{c.category} — {c.description ?? ''}</span>
                  <span className="tabular-nums">{kes(c.amount)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {deviations.length > 0 && (
        <Card title="Deviations flagged" className="mt-4">
          <ul className="space-y-1 text-sm">
            {deviations.map((d) => (
              <li key={d.id} className="flex justify-between">
                <span className="capitalize">{d.type.replace(/_/g, ' ')}</span>
                <span className="text-muted">{dateTime(d.detected_at)}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </>
  );
}
