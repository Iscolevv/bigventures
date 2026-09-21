import { requireDriver } from '@/lib/driver-session';
import { vehiclesForDriver } from '@/lib/vehicles';
import { db, schema, eq, and, sql } from '@bv/db';
import { driverPodBacklog } from '@bv/db/queries';
import { PO_UPLOAD_WINDOW_HOURS } from '@bv/core/reference';
import { QuickLogForm } from '@/components/driver/QuickLogForm';
import { PodBlock } from '@/components/driver/PodBlock';

export const dynamic = 'force-dynamic';

export default async function QuickLogPage() {
  const me = await requireDriver();
  const vehicles = await vehiclesForDriver(me.driverId);

  const freq = await db.execute(sql`
    select d.destination_address as s, count(*)::int as n, max(d.created_at) as last
    from bigventures.drops d join bigventures.trips t on t.id = d.trip_id
    where t.driver_id = ${me.driverId}
    group by 1 order by n desc, last desc limit 14`);
  const recentStops = (freq.rows as { s: string }[]).map((r) => r.s);
  const lastTrip = await db.execute(sql`
    select d.destination_address as s from bigventures.drops d
    where d.trip_id = (select id from bigventures.trips where driver_id = ${me.driverId} order by created_at desc limit 1)
    order by d.sequence`);
  const lastTripStops = (lastTrip.rows as { s: string }[]).map((r) => r.s);

  const overdue = (await driverPodBacklog(db, me.driverId, PO_UPLOAD_WINDOW_HOURS)).filter((b) => b.overdue);
  if (overdue.length > 0) {
    return (
      <>
        <h1 className="text-lg font-semibold">Log a trip</h1>
        <PodBlock items={overdue} hours={PO_UPLOAD_WINDOW_HOURS} />
      </>
    );
  }

  return (
    <>
      <h1 className="text-lg font-semibold">Log a trip</h1>
      <p className="mt-1 text-sm text-muted">List today&apos;s stops, same as you&apos;d text the group.</p>
      <QuickLogForm vehicles={vehicles} recentStops={recentStops} lastTripStops={lastTripStops} />
    </>
  );
}
