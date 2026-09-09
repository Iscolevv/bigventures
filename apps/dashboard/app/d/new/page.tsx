import { requireDriver } from '@/lib/driver-session';
import { db, schema, eq, and, sql } from '@bv/db';
import { NewTripForm } from '@/components/driver/NewTripForm';

export const dynamic = 'force-dynamic';

export default async function NewTripPage() {
  const me = await requireDriver();
  const vehicles = await db
    .select({ id: schema.vehicles.id, reg: schema.vehicles.registration })
    .from(schema.vehicleAssignments)
    .innerJoin(schema.vehicles, eq(schema.vehicles.id, schema.vehicleAssignments.vehicle_id))
    .where(and(eq(schema.vehicleAssignments.driver_id, me.driverId), sql`${schema.vehicleAssignments.end_date} is null`))
    .orderBy(schema.vehicles.registration);

  return (
    <>
      <h1 className="text-lg font-semibold">Start a trip</h1>
      <p className="mt-1 text-sm text-muted">Pick your vehicle and where you&apos;re loading.</p>
      <NewTripForm vehicles={vehicles} />
    </>
  );
}
