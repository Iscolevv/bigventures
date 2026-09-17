import { requireDriver } from '@/lib/driver-session';
import { db, schema, eq, and, sql } from '@bv/db';
import { QuickLogForm } from '@/components/driver/QuickLogForm';

export const dynamic = 'force-dynamic';

export default async function QuickLogPage() {
  const me = await requireDriver();
  const vehicles = await db
    .select({ id: schema.vehicles.id, reg: schema.vehicles.registration })
    .from(schema.vehicleAssignments)
    .innerJoin(schema.vehicles, eq(schema.vehicles.id, schema.vehicleAssignments.vehicle_id))
    .where(and(eq(schema.vehicleAssignments.driver_id, me.driverId), sql`${schema.vehicleAssignments.end_date} is null`))
    .orderBy(schema.vehicles.registration);

  return (
    <>
      <h1 className="text-lg font-semibold">Log a trip</h1>
      <p className="mt-1 text-sm text-muted">List today&apos;s stops, same as you&apos;d text the group.</p>
      <QuickLogForm vehicles={vehicles} />
    </>
  );
}
