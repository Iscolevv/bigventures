import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireDriver } from '@/lib/driver-session';
import { db, schema, eq } from '@bv/db';
import { FuelForm } from '@/components/driver/FuelForm';

export const dynamic = 'force-dynamic';

export default async function FuelPage({ params }: { params: Promise<{ id: string }> }) {
  const me = await requireDriver();
  const { id } = await params;
  const [trip] = await db.select().from(schema.trips).where(eq(schema.trips.id, id)).limit(1);
  if (!trip || trip.driver_id !== me.driverId) notFound();

  return (
    <>
      <Link href={`/d/t/${id}`} className="text-sm text-muted">
        ← Trip
      </Link>
      <h1 className="mt-2 text-lg font-semibold">Fuel entry</h1>
      <FuelForm tripId={id} />
    </>
  );
}
