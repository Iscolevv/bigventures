import { notFound } from 'next/navigation';
import { requireDriver } from '@/lib/driver-session';
import { db, schema, eq } from '@bv/db';
import { VEHICLE_CHECK_TEMPLATE } from '@bv/core/reference';
import { VehicleCheckForm } from '@/components/driver/VehicleCheckForm';

export const dynamic = 'force-dynamic';

export default async function CheckPage({ params }: { params: Promise<{ id: string }> }) {
  const me = await requireDriver();
  const { id } = await params;
  const [trip] = await db.select().from(schema.trips).where(eq(schema.trips.id, id)).limit(1);
  if (!trip || trip.driver_id !== me.driverId) notFound();

  return (
    <>
      <h1 className="text-lg font-semibold">Vehicle check</h1>
      <p className="mt-1 text-sm text-muted">Safety-critical items must pass before you can drive.</p>
      <VehicleCheckForm tripId={id} template={VEHICLE_CHECK_TEMPLATE as unknown as CheckItem[]} />
    </>
  );
}

interface CheckItem {
  key: string;
  label: string;
  blocking: boolean;
  valueHint?: string;
}
