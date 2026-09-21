'use server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { requirePermission } from '@/lib/session';
import { writeAudit } from '@/lib/audit';
import { db, schema, eq, sql } from '@bv/db';

const num = (v: FormDataEntryValue | null) => {
  const s = String(v ?? '').trim();
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) && n >= 0 ? n : NaN;
};

/**
 * Approve a driver-logged trip: the office sets the load and the fuel (litres and
 * what it cost), and only then does the trip start counting in the numbers.
 */
export async function approveTrip(form: FormData) {
  const user = await requirePermission('trip:approve');
  const id = String(form.get('id') ?? '');
  const tonnes = num(form.get('tonnes'));
  const bales = num(form.get('bales'));
  const litres = num(form.get('litres'));
  const cost = num(form.get('cost'));
  const fail = (m: string): never => redirect(`/approvals?error=${encodeURIComponent(m)}&trip=${id}`);

  if ([tonnes, bales, litres, cost].some((n) => Number.isNaN(n))) fail('Numbers only, and not negative');
  if (litres && litres > 0 && (cost == null || cost <= 0)) fail('Enter what the fuel cost (Ksh) before approving');

  const [trip] = await db
    .select({ id: schema.trips.id, status: schema.trips.status, vehicleId: schema.trips.vehicle_id, driverId: schema.trips.driver_id, startedAt: schema.trips.started_at })
    .from(schema.trips)
    .where(eq(schema.trips.id, id))
    .limit(1);
  if (!trip || trip.status !== 'submitted') fail('That trip is not waiting for approval');

  await db
    .update(schema.trips)
    .set({
      load_tonnes: tonnes != null ? String(tonnes) : null,
      load_bales: bales != null ? Math.round(bales) : null,
      status: 'completed',
      updated_at: new Date(),
    })
    .where(eq(schema.trips.id, id));

  await db.delete(schema.fuelEntries).where(eq(schema.fuelEntries.trip_id, id));
  if (litres && litres > 0) {
    await db.insert(schema.fuelEntries).values({
      vehicle_id: trip!.vehicleId,
      driver_id: trip!.driverId,
      trip_id: id,
      litres: String(litres),
      unit_price: String(Math.round((cost! / litres) * 100) / 100),
      total_cost: String(cost),
      odometer_km: null,
      filled_at: trip!.startedAt ?? new Date(),
      source: 'dashboard',
      created_by: user.id,
      notes: 'Approved by office',
    });
  }

  await writeAudit(user, 'approve', 'trip', id, null, { tonnes, bales, litres, cost });
  revalidatePath('/approvals');
  revalidatePath('/');
  redirect('/approvals?approved=1');
}
