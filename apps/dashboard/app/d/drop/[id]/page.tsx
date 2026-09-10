import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireDriver } from '@/lib/driver-session';
import { db, schema, eq, sql } from '@bv/db';
import { objectUrl } from '@/lib/storage';
import { DeliverForm } from '@/components/driver/DeliverForm';

export const dynamic = 'force-dynamic';

export default async function DropPage({ params }: { params: Promise<{ id: string }> }) {
  const me = await requireDriver();
  const { id } = await params;

  const [row] = await db
    .select({
      drop: schema.drops,
      tripId: schema.trips.id,
      tripDriver: schema.trips.driver_id,
      tripStatus: schema.trips.status,
    })
    .from(schema.drops)
    .innerJoin(schema.trips, eq(schema.trips.id, schema.drops.trip_id))
    .where(eq(schema.drops.id, id))
    .limit(1);
  if (!row || row.tripDriver !== me.driverId) notFound();
  const d = row.drop;

  const photos = await db
    .select({ id: schema.podPhotos.id, key: schema.podPhotos.storage_key })
    .from(schema.podPhotos)
    .where(eq(schema.podPhotos.drop_id, id))
    .orderBy(sql`${schema.podPhotos.captured_at} asc`);
  const photoUrls = await Promise.all(
    photos.map(async (p) => ({ id: p.id, url: (await objectUrl(p.key)) ?? p.key })),
  );

  const closed = !['pending', 'arrived'].includes(d.status);

  return (
    <>
      <Link href={`/d/t/${row.tripId}`} className="-m-2 inline-block p-2 text-sm text-muted">
        ← Trip
      </Link>
      <h1 className="mt-1 text-lg font-semibold">Stop {d.sequence}</h1>
      <p className="wrap-anywhere text-sm text-muted">{d.destination_address}</p>
      <p className="mt-1 text-sm font-medium capitalize text-brand">{d.status}</p>

      {closed ? (
        <div className="mt-4 rounded-xl border bg-surface p-4 text-sm">
          <p className="font-medium capitalize">{d.status}</p>
          {d.signee_name && <p className="mt-1 text-muted">Received by {d.signee_name}</p>}
          {d.issue_category && <p className="mt-1 capitalize text-crit">Issue: {d.issue_category.replace('_', ' ')}</p>}
          <div className="mt-3 grid grid-cols-3 gap-2">
            {photoUrls.map((p) => (
              <img key={p.id} src={p.url} alt="POD" className="aspect-square w-full rounded-lg object-cover" />
            ))}
          </div>
        </div>
      ) : (
        <DeliverForm dropId={id} existingPhotos={photoUrls} hasArrived={d.status === 'arrived'} />
      )}
    </>
  );
}
