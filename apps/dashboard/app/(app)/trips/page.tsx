import Link from 'next/link';
import { requirePermission } from '@/lib/session';
import { db, schema } from '@bv/db';
import * as q from '@bv/db/queries';
import { PageHeader, DataTable, Badge, kes, dateTime, ExportLink, type Column } from '@/components/ui';
import { TripFilters } from '@/components/TripFilters';

export const dynamic = 'force-dynamic';

const STATUS_TONE: Record<string, 'ok' | 'warn' | 'crit' | 'muted' | 'brand'> = {
  completed: 'ok',
  in_progress: 'brand',
  pre_check: 'brand',
  flagged: 'crit',
  cancelled: 'muted',
  draft: 'muted',
};

export default async function TripsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requirePermission('trip:read');
  const sp = await searchParams;

  const [drivers, vehicles] = await Promise.all([
    db.select({ id: schema.drivers.id, name: schema.drivers.full_name }).from(schema.drivers).orderBy(schema.drivers.full_name),
    db.select({ id: schema.vehicles.id, registration: schema.vehicles.registration }).from(schema.vehicles).orderBy(schema.vehicles.registration),
  ]);

  const rows = await q.tripList(db, {
    driverId: sp.driver,
    vehicleId: sp.vehicle,
    status: sp.status,
    from: sp.from ? new Date(sp.from) : undefined,
    limit: 300,
  });

  const columns: Column<(typeof rows)[number]>[] = [
    {
      key: 'ref',
      header: 'Trip',
      render: (r) => (
        <Link href={`/trips/${r.id}`} className="font-medium text-brand hover:underline">
          {r.ref}
        </Link>
      ),
    },
    { key: 'when', header: 'Started', render: (r) => <span className="text-muted">{dateTime(r.startedAt)}</span> },
    { key: 'vehicle', header: 'Vehicle', render: (r) => r.vehicle },
    { key: 'driver', header: 'Driver', render: (r) => r.driver },
    { key: 'route', header: 'Route', render: (r) => <span className="text-muted">{r.route ?? '—'}</span> },
    { key: 'dist', header: 'Distance', align: 'right', render: (r) => `${r.distanceKm.toFixed(0)} km` },
    {
      key: 'drops',
      header: 'Drops',
      align: 'right',
      render: (r) => (
        <span>
          {r.drops}
          {r.issues > 0 && <span className="ml-1 text-crit">({r.issues}!)</span>}
        </span>
      ),
    },
    { key: 'fuel', header: 'Fuel', align: 'right', render: (r) => (r.fuelCost ? kes(r.fuelCost) : '—') },
    { key: 'status', header: 'Status', render: (r) => <Badge tone={STATUS_TONE[r.status] ?? 'muted'}>{r.status.replace('_', ' ')}</Badge> },
  ];

  return (
    <>
      <PageHeader title="Trips" subtitle={`${rows.length} trips`} actions={<ExportLink type="trips" />} />
      <TripFilters drivers={drivers} vehicles={vehicles} />
      <DataTable columns={columns} rows={rows} empty="No trips match these filters." />
    </>
  );
}
