import { BackLink } from '@/components/driver/BackLink';
import { notFound } from 'next/navigation';
import { requireDriver } from '@/lib/driver-session';
import { vehiclesForDriver } from '@/lib/vehicles';
import { loadTripEditValues } from '@/lib/trip-edit';
import { TripEditForm } from '@/components/TripEditForm';
import { editLoggedTrip } from '@/app/d/actions';

export const dynamic = 'force-dynamic';

export default async function EditLoggedTrip({ params }: { params: Promise<{ id: string }> }) {
  const me = await requireDriver();
  const { id } = await params;
  const loaded = await loadTripEditValues(id);
  if (!loaded || loaded.trip.driver_id !== me.driverId) notFound();

  if (loaded.trip.status !== 'submitted') {
    return (
      <>
        <BackLink href={`/d/t/${id}`}>Trip</BackLink>
        <h1 className="mt-1 text-lg font-semibold">{loaded.trip.reference_code}</h1>
        <p className="mt-4 rounded-lg border bg-surface p-4 text-sm text-muted">
          The office has already approved this trip, so it can&apos;t be changed here any more. If something is wrong, tell the office and they will correct it.
        </p>
      </>
    );
  }

  const vehicles = await vehiclesForDriver(me.driverId);
  return (
    <>
      <BackLink href={`/d/t/${id}`}>Trip</BackLink>
      <h1 className="mt-1 text-lg font-semibold">Edit {loaded.trip.reference_code}</h1>
      <p className="mt-1 text-sm text-muted">Fix anything you got wrong. You can edit until the office approves it.</p>
      <TripEditForm initial={loaded.values} vehicles={vehicles} editor="driver" action={editLoggedTrip} doneHref={`/d/t/${id}`} />
    </>
  );
}
