import { requirePermission } from '@/lib/session';
import { db } from '@bv/db';
import * as q from '@bv/db/queries';
import { PageHeader, Card, DataTable, StatTile, kes, pct, type Column } from '@/components/ui';
import { BarChartCard } from '@/components/Charts';
import { PeriodTabs } from '@/components/PeriodTabs';
import { resolvePeriod } from '@/lib/period';

export const dynamic = 'force-dynamic';

export default async function RoiPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requirePermission('report:read');
  const sp = await searchParams;
  const p = resolvePeriod(sp.period);

  const [roi, routes] = await Promise.all([
    q.vehicleRoiTable(db, p),
    q.routeAnalytics(db, p),
  ]);

  const revenue = roi.reduce((s, r) => s + r.revenue, 0);
  const net = roi.reduce((s, r) => s + r.netContribution, 0);
  const overhead = roi.reduce((s, r) => s + r.overhead, 0);

  const roiCols: Column<(typeof roi)[number]>[] = [
    { key: 'reg', header: 'Vehicle', render: (r) => <span className="font-medium">{r.registration}</span> },
    { key: 'trips', header: 'Trips', align: 'right', render: (r) => r.tripCount },
    { key: 'rev', header: 'Revenue', align: 'right', render: (r) => kes(r.revenue) },
    { key: 'fuel', header: 'Fuel', align: 'right', render: (r) => kes(r.fuelCost) },
    { key: 'run', header: 'Running', align: 'right', render: (r) => kes(r.runningCost) },
    { key: 'oh', header: 'Finance', align: 'right', render: (r) => kes(r.overhead) },
    {
      key: 'net',
      header: 'Net contribution',
      align: 'right',
      render: (r) => (
        <span className={r.netContribution >= 0 ? 'font-medium text-ok' : 'font-medium text-crit'}>
          {kes(r.netContribution)}
        </span>
      ),
    },
    { key: 'margin', header: 'Margin', align: 'right', render: (r) => pct(r.marginPct, 0) },
    { key: 'cpk', header: 'Cost/km', align: 'right', render: (r) => (r.costPerKm ? kes(r.costPerKm) : '—') },
  ];

  const routeCols: Column<(typeof routes)[number]>[] = [
    { key: 'route', header: 'Route', render: (r) => <span className="font-medium">{r.routeName}</span> },
    { key: 'trips', header: 'Trips', align: 'right', render: (r) => r.trips },
    { key: 'dist', header: 'Avg distance', align: 'right', render: (r) => `${r.avgDistanceKm.toFixed(0)} km` },
    { key: 'dur', header: 'Avg time', align: 'right', render: (r) => `${(r.avgDurationMin / 60).toFixed(1)} h` },
    { key: 'fuel', header: 'Avg fuel', align: 'right', render: (r) => kes(r.avgFuel) },
    { key: 'range', header: 'Fuel range', align: 'right', render: (r) => `${kes(r.minFuel)} – ${kes(r.maxFuel)}` },
  ];

  return (
    <>
      <PageHeader title="ROI & route analytics" subtitle={p.label} actions={<PeriodTabs current={p.key} />} />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Revenue" value={kes(revenue)} />
        <StatTile label="Allocated finance" value={kes(overhead)} />
        <StatTile label="Net contribution" value={kes(net)} tone={net >= 0 ? 'ok' : 'crit'} />
        <StatTile label="Fleet margin" value={pct(revenue > 0 ? (net / revenue) * 100 : null, 0)} />
      </div>

      <Card title="Net contribution per vehicle" className="mt-6">
        <BarChartCard
          data={roi.map((r) => ({ vehicle: r.registration, net: Math.round(r.netContribution) }))}
          xKey="vehicle"
          yKey="net"
          highlight={(d) => Number(d.net) < 0}
          format={(v) => kes(v)}
        />
      </Card>

      <h2 className="mb-2 mt-6 text-sm font-semibold">Per-vehicle ROI</h2>
      <DataTable columns={roiCols} rows={roi} />

      <h2 className="mb-2 mt-6 text-sm font-semibold">Route cost roll-up</h2>
      <p className="mb-2 text-xs text-muted">
        Historical trips grouped by route. Use the range to spot runs whose fuel cost swings widely.
      </p>
      <DataTable columns={routeCols} rows={routes} empty="No trips in this window." />
    </>
  );
}
