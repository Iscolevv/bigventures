import { requireDriver } from '@/lib/driver-session';
import { vehiclesForDriver } from '@/lib/vehicles';
import { db, schema, eq, and, sql } from '@bv/db';
import { NewTripForm } from '@/components/driver/NewTripForm';

export const dynamic = 'force-dynamic';

export default async function NewTripPage() {
  const me = await requireDriver();
  const vehicles = await vehiclesForDriver(me.driverId);

  return (
    <>
      <h1 className="text-lg font-semibold">Start a trip</h1>
      <p className="mt-1 text-sm text-muted">Pick your vehicle and where you&apos;re loading.</p>
      <NewTripForm vehicles={vehicles} />
    </>
  );
}
