import { requireDriver } from '@/lib/driver-session';
import { vehiclesForDriver } from '@/lib/vehicles';
import { db, schema, eq, and, sql } from '@bv/db';
import { VEHICLE_CHECK_TEMPLATE } from '@bv/core/reference';
import { driverPodBacklog } from '@bv/db/queries';
import { PO_UPLOAD_WINDOW_HOURS } from '@bv/core/reference';
import { VehicleCheckForm } from '@/components/driver/VehicleCheckForm';
import { PodBlock } from '@/components/driver/PodBlock';

export const dynamic = 'force-dynamic';

export default async function DailyCheckPage() {
  const me = await requireDriver();
  const vehicles = await vehiclesForDriver(me.driverId);

  const overdue = (await driverPodBacklog(db, me.driverId, PO_UPLOAD_WINDOW_HOURS)).filter((b) => b.overdue);
  if (overdue.length > 0) {
    return (
      <>
        <h1 className="text-lg font-semibold">Today&apos;s vehicle check</h1>
        <PodBlock items={overdue} hours={PO_UPLOAD_WINDOW_HOURS} />
      </>
    );
  }

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
