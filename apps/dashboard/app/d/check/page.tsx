import { requireDriver } from '@/lib/driver-session';
import { db, schema, eq, and, sql } from '@bv/db';
import { VEHICLE_CHECK_TEMPLATE } from '@bv/core/reference';
import { VehicleCheckForm } from '@/components/driver/VehicleCheckForm';

export const dynamic = 'force-dynamic';

export default async function DailyCheckPage() {
  const me = await requireDriver();
  const vehicles = await db
    .select({ id: schema.vehicles.id, reg: schema.vehicles.registration })
    .from(schema.vehicleAssignments)
    .innerJoin(schema.vehicles, eq(schema.vehicles.id, schema.vehicleAssignments.vehicle_id))
    .where(and(eq(schema.vehicleAssignments.driver_id, me.driverId), sql`${schema.vehicleAssignments.end_date} is null`))
    .orderBy(schema.vehicles.registration);

  return (
    <>
      <h1 className="text-lg font-semibold">Today&apos;s vehicle check</h1>
      <p className="mt-1 text-sm text-muted">Once a day, before your first trip. Safety-critical items must pass before you can drive.</p>
      <VehicleCheckForm vehicles={vehicles} template={VEHICLE_CHECK_TEMPLATE as unknown as CheckItem[]} />
    </>
  );
}

interface CheckItem {
  key: string;
  label: string;
  blocking: boolean;
  valueHint?: string;
}
