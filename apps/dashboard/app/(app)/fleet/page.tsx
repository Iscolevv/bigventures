import Link from 'next/link';
import { requirePermission, can } from '@/lib/session';
import { db, schema, sql } from '@bv/db';
import { PageHeader, Card, Badge } from '@/components/ui';

export const dynamic = 'force-dynamic';

const STATUS_TONE: Record<string, 'ok' | 'warn' | 'crit' | 'muted'> = {
  active: 'ok',
  in_repair: 'warn',
  grounded: 'crit',
  inactive: 'muted',
  sold: 'muted',
};

export default async function FleetPage() {
  const user = await requirePermission('vehicle:read');
  const canEdit = can(user.role, 'vehicle:update');

  const vehicles = await db
    .select({
      id: schema.vehicles.id,
      registration: schema.vehicles.registration,
      type: schema.vehicles.vehicle_type,
      status: schema.vehicles.status,
      driver: schema.drivers.full_name,
    })
    .from(schema.vehicles)
    .leftJoin(
      schema.vehicleAssignments,
      sql`${schema.vehicleAssignments.vehicle_id} = ${schema.vehicles.id} and ${schema.vehicleAssignments.end_date} is null`,
    )
    .leftJoin(schema.drivers, sql`${schema.drivers.id} = ${schema.vehicleAssignments.driver_id}`)
    .orderBy(schema.vehicles.registration);

  return (
    <>
      <PageHeader
        title="Fleet"
        subtitle={`${vehicles.length} vehicles`}
        actions={
          can(user.role, 'vehicle:create') && (
            <Link href="/fleet/new" className="rounded-md bg-brand px-3 py-2 text-sm font-semibold text-white">
              + Add vehicle
            </Link>
          )
        }
      />
      <Card className="overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead className="border-b text-left text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="px-4 py-3">Registration</th>
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Usual driver</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {vehicles.map((v) => (
              <tr key={v.id} className="border-b last:border-0">
                <td className="px-4 py-3 font-medium">{v.registration}</td>
                <td className="px-4 py-3 capitalize text-muted">{v.type}</td>
                <td className="px-4 py-3">
                  <Badge tone={STATUS_TONE[v.status] ?? 'muted'}>{v.status.replace('_', ' ')}</Badge>
                </td>
                <td className="px-4 py-3 text-muted">{v.driver ?? '-'}</td>
                <td className="px-4 py-3 text-right">
                  {canEdit && (
                    <Link href={`/fleet/${v.id}`} className="text-brand hover:underline">
                      Edit
                    </Link>
                  )}
                </td>
              </tr>
            ))}
            {vehicles.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-muted">
                  No vehicles yet. Add the first one.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>
    </>
  );
}
