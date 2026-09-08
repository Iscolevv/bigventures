import { requirePermission } from '@/lib/session';
import { db, schema, sql, desc } from '@bv/db';
import { PageHeader, Card, kes } from '@/components/ui';

const STATUS_TONE: Record<string, string> = {
  active: 'bg-ok/10 text-ok',
  in_repair: 'bg-warn/10 text-warn',
  grounded: 'bg-crit/10 text-crit',
  inactive: 'bg-muted/10 text-muted',
  sold: 'bg-muted/10 text-muted',
};

export default async function FleetPage() {
  await requirePermission('vehicle:read');

  const vehicles = await db
    .select({
      id: schema.vehicles.id,
      registration: schema.vehicles.registration,
      type: schema.vehicles.vehicle_type,
      status: schema.vehicles.status,
      odometer: schema.vehicles.odometer_km,
      finance: schema.vehicles.monthly_finance_cost,
      driver: schema.drivers.full_name,
    })
    .from(schema.vehicles)
    .leftJoin(
      schema.vehicleAssignments,
      sql`${schema.vehicleAssignments.vehicle_id} = ${schema.vehicles.id} and ${schema.vehicleAssignments.end_date} is null`,
    )
    .leftJoin(schema.drivers, sql`${schema.drivers.id} = ${schema.vehicleAssignments.driver_id}`)
    .orderBy(desc(schema.vehicles.status), schema.vehicles.registration);

  return (
    <>
      <PageHeader title="Fleet" subtitle={`${vehicles.length} vehicles`} />
      <Card className="overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead className="border-b text-left text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="px-4 py-3">Registration</th>
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Assigned driver</th>
              <th className="px-4 py-3 text-right">Odometer (km)</th>
              <th className="px-4 py-3 text-right">Monthly finance</th>
            </tr>
          </thead>
          <tbody>
            {vehicles.map((v) => (
              <tr key={v.id} className="border-b last:border-0">
                <td className="px-4 py-3 font-medium">{v.registration}</td>
                <td className="px-4 py-3 capitalize text-muted">{v.type}</td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      STATUS_TONE[v.status] ?? 'bg-muted/10 text-muted'
                    }`}
                  >
                    {v.status.replace('_', ' ')}
                  </span>
                </td>
                <td className="px-4 py-3 text-muted">{v.driver ?? '—'}</td>
                <td className="px-4 py-3 text-right tabular-nums">
                  {Number(v.odometer).toLocaleString()}
                </td>
                <td className="px-4 py-3 text-right tabular-nums">{kes(Number(v.finance))}</td>
              </tr>
            ))}
            {vehicles.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-muted">
                  No vehicles yet — run <code>pnpm db:seed</code> or add one.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>
    </>
  );
}
