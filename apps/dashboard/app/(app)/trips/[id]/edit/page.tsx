import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requirePermission } from '@/lib/session';
import { loadTripEditValues } from '@/lib/trip-edit';
import { TripEditForm } from '@/components/TripEditForm';
import { PageHeader } from '@/components/ui';
import { db, schema, eq } from '@bv/db';
import { editTrip } from '../actions';

export const dynamic = 'force-dynamic';

export default async function EditTripPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePermission('trip:update');
  const { id } = await params;
  const loaded = await loadTripEditValues(id);
  if (!loaded) notFound();

  const vehicles = await db
    .select({ id: schema.vehicles.id, reg: schema.vehicles.registration })
    .from(schema.vehicles)
    .where(eq(schema.vehicles.status, 'active'))
    .orderBy(schema.vehicles.registration);
  const [driver] = await db
    .select({ name: schema.drivers.full_name })
    .from(schema.drivers)
    .where(eq(schema.drivers.id, loaded.trip.driver_id))
    .limit(1);

  return (
    <>
      <PageHeader
        title={`Edit ${loaded.trip.reference_code}`}
        subtitle={`Logged by ${driver?.name ?? 'driver'} · ${loaded.trip.status === 'submitted' ? 'waiting for approval' : loaded.trip.status.replace('_', ' ')}`}
        actions={
          <Link href={`/trips/${id}`} className="rounded-md border px-3 py-1.5 text-sm hover:bg-bg">
            Cancel
          </Link>
        }
      />
      <TripEditForm
        initial={loaded.values}
        vehicles={vehicles}
        editor="office"
        action={editTrip}
        doneHref={`/trips/${id}?msg=${encodeURIComponent('Trip updated')}`}
        approved={loaded.trip.status === 'completed'}
      />
    </>
  );
}
