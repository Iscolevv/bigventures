import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireDriver } from '@/lib/driver-session';
import { db, schema, eq } from '@bv/db';
import { AddDropForm } from '@/components/driver/AddDropForm';

export const dynamic = 'force-dynamic';

export default async function DropsPage({ params }: { params: Promise<{ id: string }> }) {
  const me = await requireDriver();
  const { id } = await params;
  const [trip] = await db.select().from(schema.trips).where(eq(schema.trips.id, id)).limit(1);
  if (!trip || trip.driver_id !== me.driverId) notFound();

  const drops = await db
    .select({ id: schema.drops.id, seq: schema.drops.sequence, address: schema.drops.destination_address, status: schema.drops.status })
    .from(schema.drops)
    .where(eq(schema.drops.trip_id, id))
    .orderBy(schema.drops.sequence);

  return (
    <>
      <Link href={`/d/t/${id}`} className="text-sm text-muted">
        ← Trip
      </Link>
      <h1 className="mt-2 text-lg font-semibold">Drops</h1>

      <div className="mt-3 space-y-2">
        {drops.map((d) => (
          <div key={d.id} className="rounded-xl border bg-surface p-3 text-sm">
            <span className="font-medium">
              {d.seq}. {d.address}
            </span>
            <span className="ml-2 text-xs capitalize text-muted">{d.status}</span>
          </div>
        ))}
      </div>

      <h2 className="mt-5 text-sm font-semibold">Add a drop</h2>
      <AddDropForm tripId={id} />
    </>
  );
}
