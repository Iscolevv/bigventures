import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireDriver } from '@/lib/driver-session';
import { db, schema, eq, sql } from '@bv/db';
import { TripActions } from '@/components/driver/TripActions';
import { TrailTracker } from '@/components/driver/TrailTracker';

export const dynamic = 'force-dynamic';

const DROP: Record<string, string> = {
  pending: 'text-muted',
  arrived: 'text-brand',
  delivered: 'text-ok',
  partial: 'text-warn',
  failed: 'text-crit',
  returned: 'text-crit',
};

export default async function DriverTrip({ params }: { params: Promise<{ id: string }> }) {
  const me = await requireDriver();
  const { id } = await params;

  const [trip] = await db.select().from(schema.trips).where(eq(schema.trips.id, id)).limit(1);
  if (!trip || trip.driver_id !== me.driverId) notFound();

  const [vehicle] = await db
    .select({ reg: schema.vehicles.registration })
    .from(schema.vehicles)
    .where(eq(schema.vehicles.id, trip.vehicle_id))
    .limit(1);

  const drops = await db
    .select({
      id: schema.drops.id,
      seq: schema.drops.sequence,
      address: schema.drops.destination_address,
      status: schema.drops.status,
      photos: sql<number>`(select count(*)::int from ${schema.podPhotos} where ${schema.podPhotos.drop_id} = ${schema.drops.id})`,
    })
    .from(schema.drops)
    .where(eq(schema.drops.trip_id, id))
    .orderBy(schema.drops.sequence);

  const [{ n: checks } = { n: 0 }] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(schema.vehicleChecks)
    .where(eq(schema.vehicleChecks.trip_id, id));

  const allClosed = drops.length > 0 && drops.every((d) => !['pending', 'arrived'].includes(d.status));

  return (
    <>
      <Link href="/d" className="text-sm text-muted">
        ← My trips
      </Link>
      <h1 className="mt-2 text-lg font-semibold">{trip.reference_code}</h1>
      <p className="text-sm text-muted">
        {vehicle?.reg} · {trip.loading_point_address}
      </p>
      <p className="mt-1 text-sm font-medium text-brand">{trip.status.replace('_', ' ')}</p>

      {trip.status === 'in_progress' && <TrailTracker tripId={id} />}

      <div className="mt-5 flex items-center justify-between">
        <h2 className="text-sm font-semibold">Drops ({drops.length})</h2>
        {trip.status !== 'completed' && trip.status !== 'cancelled' && (
          <Link href={`/d/t/${id}/drops`} className="text-sm font-medium text-brand">
            + Add / edit
          </Link>
        )}
      </div>
      <div className="mt-2 space-y-2">
        {drops.length === 0 && <p className="text-sm text-muted">No drops yet — add at least one.</p>}
        {drops.map((d) => (
          <Link key={d.id} href={`/d/drop/${d.id}`} className="flex items-center justify-between rounded-xl border bg-surface p-3">
            <div>
              <p className="text-sm font-medium">
                {d.seq}. {d.address}
              </p>
              <p className="text-xs text-muted">
                {d.photos > 0 ? `${d.photos} photo${d.photos > 1 ? 's' : ''}` : 'no photo'}
              </p>
            </div>
            <span className={`text-xs font-semibold capitalize ${DROP[d.status] ?? 'text-muted'}`}>{d.status}</span>
          </Link>
        ))}
      </div>

      <TripActions
        tripId={id}
        status={trip.status}
        hasCheck={checks > 0}
        dropCount={drops.length}
        allClosed={allClosed}
      />
    </>
  );
}
