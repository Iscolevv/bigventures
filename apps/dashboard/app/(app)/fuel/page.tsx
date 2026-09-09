import { requirePermission } from '@/lib/session';
import { db } from '@bv/db';
import * as q from '@bv/db/queries';
import { PageHeader, Card, DataTable, StatTile, Badge, kes, ExportLink, type Column } from '@/components/ui';
import { BarChartCard } from '@/components/Charts';
import { PeriodTabs } from '@/components/PeriodTabs';
import { resolvePeriod } from '@/lib/period';

export const dynamic = 'force-dynamic';

export default async function FuelPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requirePermission('fuel:read');
  const sp = await searchParams;
  const p = resolvePeriod(sp.period);

  const [rows, anomalies] = await Promise.all([
    q.fuelByVehicle(db, p),
    q.fuelAnomalies(db, p),
  ]);

  const totalLitres = rows.reduce((s, r) => s + r.litres, 0);
  const totalCost = rows.reduce((s, r) => s + r.fuelCost, 0);
  const totalKm = rows.reduce((s, r) => s + r.distanceKm, 0);
  const fleetL100 = totalKm > 0 ? (totalLitres / totalKm) * 100 : null;

  const chartData = rows
    .filter((r) => r.litresPer100Km != null)
    .map((r) => ({ vehicle: r.registration, l100: Number(r.litresPer100Km!.toFixed(1)) }));

  const columns: Column<(typeof rows)[number]>[] = [
    { key: 'reg', header: 'Vehicle', render: (r) => <span className="font-medium">{r.registration}</span> },
    { key: 'fills', header: 'Fills', align: 'right', render: (r) => r.fills },
    { key: 'litres', header: 'Litres', align: 'right', render: (r) => r.litres.toFixed(0) },
    { key: 'km', header: 'Distance', align: 'right', render: (r) => `${r.distanceKm.toFixed(0)} km` },
    {
      key: 'l100',
      header: 'L / 100 km',
      align: 'right',
      render: (r) => (r.litresPer100Km == null ? '—' : r.litresPer100Km.toFixed(1)),
    },
    { key: 'cpk', header: 'Cost / km', align: 'right', render: (r) => (r.costPerKm == null ? '—' : kes(r.costPerKm)) },
    { key: 'cost', header: 'Fuel cost', align: 'right', render: (r) => kes(r.fuelCost) },
  ];

  return (
    <>
      <PageHeader
        title="Fuel & consumption"
        subtitle={p.label}
        actions={<div className="flex gap-2"><ExportLink type="fuel" /><PeriodTabs current={p.key} /></div>}
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Litres" value={totalLitres.toFixed(0)} />
        <StatTile label="Fuel spend" value={kes(totalCost)} />
        <StatTile label="Fleet L/100km" value={fleetL100 ? fleetL100.toFixed(1) : '—'} />
        <StatTile label="Anomalies" value={anomalies.length} tone={anomalies.length ? 'warn' : 'ok'} />
      </div>

      <Card title="Consumption per vehicle (L / 100 km)" className="mt-6">
        {chartData.length ? (
          <BarChartCard
            data={chartData}
            xKey="vehicle"
            yKey="l100"
            highlight={(d) => Number(d.l100) > (fleetL100 ?? 0) * 1.2}
          />
        ) : (
          <p className="text-sm text-muted">Not enough odometer data in this window.</p>
        )}
      </Card>

      <div className="mt-6">
        <DataTable columns={columns} rows={rows} />
      </div>

      <Card title="Consumption anomalies" className="mt-6">
        {anomalies.length === 0 ? (
          <p className="text-sm text-muted">No trips consumed significantly more than each vehicle&apos;s baseline.</p>
        ) : (
          <ul className="divide-y">
            {anomalies.map((a) => (
              <li key={a.tripId} className="flex items-center justify-between py-2 text-sm">
                <div>
                  <span className="font-medium">{a.ref}</span> · {a.vehicle} · {a.driver}
                </div>
                <div className="flex items-center gap-3">
                  <span className="tabular-nums">{a.litresPer100Km} L/100km</span>
                  <Badge tone="warn">{a.reason}</Badge>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
