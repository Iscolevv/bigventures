import { requirePermission } from '@/lib/session';
import { db } from '@bv/db';
import * as q from '@bv/db/queries';
import { PageHeader, DataTable, StatTile, kes, ExportLink, type Column } from '@/components/ui';
import { PeriodTabs } from '@/components/PeriodTabs';
import { resolvePeriod } from '@/lib/period';

export const dynamic = 'force-dynamic';

/** Fuel from approved trips only: litres come from drivers, the price from whoever approves the trip. */
export default async function FuelPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requirePermission('fuel:read');
  const sp = await searchParams;
  const p = resolvePeriod(sp.period);
  const rows = await q.fuelByVehicle(db, p);

  const totalLitres = rows.reduce((s, r) => s + r.litres, 0);
  const totalCost = rows.reduce((s, r) => s + r.fuelCost, 0);
  const totalFills = rows.reduce((s, r) => s + r.fills, 0);
  const avgPrice = totalLitres > 0 ? totalCost / totalLitres : null;

  const columns: Column<(typeof rows)[number]>[] = [
    { key: 'reg', header: 'Vehicle', render: (r) => <span className="font-medium">{r.registration}</span> },
    { key: 'fills', header: 'Fills', align: 'right', render: (r) => r.fills },
    { key: 'litres', header: 'Litres', align: 'right', render: (r) => r.litres.toFixed(0) },
    { key: 'cost', header: 'Fuel cost', align: 'right', render: (r) => kes(r.fuelCost) },
    { key: 'ppl', header: 'Avg price / L', align: 'right', render: (r) => (r.litres > 0 ? kes(r.fuelCost / r.litres) : '-') },
  ];

  return (
    <>
      <PageHeader
        title="Fuel"
        subtitle={`${p.label} · approved trips only`}
        actions={<div className="flex gap-2"><ExportLink type="fuel" /><PeriodTabs current={p.key} /></div>}
      />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Litres" value={totalLitres.toFixed(0)} />
        <StatTile label="Fuel spend" value={kes(totalCost)} />
        <StatTile label="Avg price / L" value={avgPrice ? kes(avgPrice) : '-'} />
        <StatTile label="Fills" value={totalFills} />
      </div>
      <div className="mt-6">
        <DataTable columns={columns} rows={rows} />
      </div>
    </>
  );
}
