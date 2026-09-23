import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requirePermission } from '@/lib/session';
import { db, schema, eq } from '@bv/db';
import * as q from '@bv/db/queries';
import { PageHeader, Card, Badge, StatTile, DataTable, kes, dateTime, dateShort, type Column } from '@/components/ui';
import { PeriodTabs } from '@/components/PeriodTabs';
import { resolvePeriod } from '@/lib/period';

export const dynamic = 'force-dynamic';

const TRIP_TONE: Record<string, 'ok' | 'warn' | 'crit' | 'muted' | 'brand'> = {
  completed: 'ok',
  submitted: 'warn',
  flagged: 'crit',
  cancelled: 'muted',
};

export default async function VehicleRoiDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requirePermission('report:read');
  const { id } = await params;
  const sp = await searchParams;
  const p = resolvePeriod(sp.period);

  const [vehicle] = await db.select({ registration: schema.vehicles.registration }).from(schema.vehicles).where(eq(schema.vehicles.id, id)).limit(1);
  if (!vehicle) notFound();

  const [roi, breakdown] = await Promise.all([q.vehicleRoiTable(db, p), q.vehicleCostBreakdown(db, id, p)]);
  const row = roi.find((r) => r.vehicleId === id);

  const tripCols: Column<(typeof breakdown.trips)[number]>[] = [
    {
      key: 'ref',
      header: 'Trip',
      render: (r) => (
        <Link href={`/trips/${r.id}`} className="font-medium text-brand hover:underline">
          {r.ref}
        </Link>
      ),
    },
    { key: 'date', header: 'Date', render: (r) => <span className="text-muted">{dateTime(r.date)}</span> },
    { key: 'driver', header: 'Driver', render: (r) => r.driver },
    { key: 'status', header: 'Status', render: (r) => <Badge tone={TRIP_TONE[r.status] ?? 'muted'}>{r.status}</Badge> },
    { key: 'billed', header: 'Billed', align: 'right', render: (r) => (r.billedAmount != null ? kes(r.billedAmount) : <span className="text-muted">not billed</span>) },
    { key: 'fuel', header: 'Fuel', align: 'right', render: (r) => (r.fuelCost > 0 ? `${r.fuelLitres.toFixed(0)} L · ${kes(r.fuelCost)}` : '-') },
    { key: 'dist', header: 'Distance', align: 'right', render: (r) => (r.distanceKm != null ? `${r.distanceKm.toFixed(0)} km` : '-') },
  ];

  const costCols: Column<(typeof breakdown.costs)[number]>[] = [
    { key: 'date', header: 'Date', render: (r) => <span className="text-muted">{dateShort(r.date)}</span> },
    { key: 'cat', header: 'Category', render: (r) => <span className="capitalize">{r.category}</span> },
    { key: 'desc', header: 'Description', render: (r) => r.description ?? '-' },
    { key: 'vendor', header: 'Paid to', render: (r) => <span className="text-muted">{r.vendor ?? '-'}</span> },
    { key: 'amt', header: 'Amount', align: 'right', render: (r) => kes(r.amount) },
  ];

  return (
    <>
      <PageHeader
        title={vehicle.registration}
        subtitle={`${p.label} · everything behind this truck's ROI row`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Link href="/roi" className="rounded-md border px-3 py-1.5 text-sm hover:bg-bg">
              ← All vehicles
            </Link>
            <PeriodTabs current={p.key} />
          </div>
        }
      />

      {!row || row.tripCount === 0 ? (
        <Card>
          <p className="text-sm text-muted">No trips for this vehicle in this window.</p>
        </Card>
      ) : (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatTile label="Revenue" value={kes(row.revenue)} />
          <StatTile label="Fuel" value={kes(row.fuelCost)} />
          <StatTile label="Running costs" value={kes(row.runningCost)} />
          <StatTile label="Net contribution" value={kes(row.netContribution)} tone={row.netContribution >= 0 ? 'ok' : 'crit'} />
          <StatTile label="Trips" value={row.tripCount} />
          <StatTile label="Distance" value={row.distanceKm > 0 ? `${row.distanceKm.toFixed(0)} km` : '-'} hint={row.distanceKm === 0 ? 'add start/end odometer when approving a trip' : undefined} />
          <StatTile label="Cost / km" value={row.costPerKm != null ? kes(row.costPerKm) : '-'} />
          <StatTile label="Margin" value={row.marginPct != null ? `${row.marginPct.toFixed(0)}%` : '-'} />
        </div>
      )}

      <h2 className="mb-2 mt-6 text-sm font-semibold">Trips ({breakdown.trips.length})</h2>
      <DataTable columns={tripCols} rows={breakdown.trips} empty="No trips in this window." />

      {breakdown.manualInvoices.length > 0 && (
        <>
          <h2 className="mb-2 mt-6 text-sm font-semibold">One-off invoices tagged to this truck</h2>
          <Card className="p-0">
            <ul className="divide-y text-sm">
              {breakdown.manualInvoices.map((m) => (
                <li key={m.id} className="flex items-center justify-between px-4 py-2.5">
                  <span>
                    <span className="font-medium">{m.invoiceNumber}</span>
                    <span className="ml-2 text-muted">{m.description} · {dateShort(m.issueDate)}</span>
                  </span>
                  <span className="tabular-nums">{kes(m.amount)}</span>
                </li>
              ))}
            </ul>
          </Card>
        </>
      )}

      <h2 className="mb-2 mt-6 text-sm font-semibold">Running costs ({breakdown.costs.length})</h2>
      <DataTable columns={costCols} rows={breakdown.costs} empty="No costs recorded against this vehicle in this window." />
    </>
  );
}
