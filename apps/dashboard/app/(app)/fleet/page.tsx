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

  // usual driver: the one set by hand, else whoever drove it most in the last 30 days
  const res = await db.execute(sql`
    select v.id, v.registration, v.vehicle_type as type, v.status,
      d.full_name as assigned,
      (select dr.full_name from bigventures.trips t join bigventures.drivers dr on dr.id = t.driver_id
        where t.vehicle_id = v.id and t.started_at > now() - interval '30 days' and t.status <> 'cancelled'
        group by dr.full_name order by count(*) desc limit 1) as recent
    from bigventures.vehicles v
    left join bigventures.vehicle_assignments a on a.vehicle_id = v.id and a.end_date is null
    left join bigventures.drivers d on d.id = a.driver_id
    order by v.registration`);
  const vehicles = (res.rows as { id: string; registration: string; type: string; status: string; assigned: string | null; recent: string | null }[]).map((r) => ({
    ...r,
    driver: r.assigned,
    auto: !r.assigned && !!r.recent,
  }));

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
                <td className="px-4 py-3 text-muted">{v.driver ?? (v.recent ? <span title="Not set - shown because they drove it most in the last 30 days">{v.recent} <span className="text-xs">(most used lately)</span></span> : '-')}</td>
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
