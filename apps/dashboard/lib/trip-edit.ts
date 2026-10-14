import { db, schema, eq, and, sql, inArray } from '@bv/db';
import { poOwner } from '@bv/db/queries';
import { DROP_STATUSES, type DropStatus } from '@bv/core/enums';
import { writeAudit } from './audit';
import { vehicleIsUsable } from './vehicles';
import type { SessionUser } from './session';

/**
 * Correcting a trip after it was logged. Two callers:
 *  - the driver, while the trip is still `submitted` (sent, not yet approved);
 *  - the office (`trip:update`), at any status - including after approval.
 * Both go through `applyTripEdit` so the rules and the audit trail are the same.
 */

export interface TripEditDrop {
  /** null = a stop added during the edit */
  id: string | null;
  address: string;
  po: string;
  signee: string;
  status: DropStatus;
  /** PO photos already on the drop (read-only, from the server) */
  photos: number;
}

export interface TripEditValues {
  tripId: string;
  date: string; // YYYY-MM-DD, Nairobi
  vehicleId: string;
  loadingAddress: string;
  loadTonnes: string;
  loadBales: string;
  fuelLitres: string;
  fuelCost: string;
  startOdometer: string;
  endOdometer: string;
  drops: TripEditDrop[];
}

export type EditorKind = 'driver' | 'office';

const nairobiDay = (d: Date) => new Date(d.getTime() + 3 * 3600_000).toISOString().slice(0, 10);
const str = (v: unknown) => (v == null ? '' : String(Number(v)));

export async function loadTripEditValues(tripId: string) {
  const [trip] = await db.select().from(schema.trips).where(eq(schema.trips.id, tripId)).limit(1);
  if (!trip) return null;
  const drops = await db
    .select({
      id: schema.drops.id,
      address: schema.drops.destination_address,
      po: schema.drops.po_number,
      signee: schema.drops.signee_name,
      status: schema.drops.status,
      photos: sql<number>`(select count(*)::int from bigventures.pod_photos pp where pp.drop_id = bigventures.drops.id)`,
    })
    .from(schema.drops)
    .where(eq(schema.drops.trip_id, tripId))
    .orderBy(schema.drops.sequence);
  const fuel = await fuelTotals(tripId);

  const values: TripEditValues = {
    tripId,
    date: nairobiDay(trip.started_at ?? trip.created_at),
    vehicleId: trip.vehicle_id,
    loadingAddress: trip.loading_point_address === 'Not recorded' ? '' : trip.loading_point_address,
    loadTonnes: str(trip.load_tonnes),
    loadBales: str(trip.load_bales),
    fuelLitres: fuel.litres ? String(fuel.litres) : '',
    fuelCost: fuel.cost ? String(fuel.cost) : '',
    startOdometer: str(trip.start_odometer_km),
    endOdometer: str(trip.end_odometer_km),
    drops: drops.map((d) => ({ id: d.id, address: d.address, po: d.po ?? '', signee: d.signee ?? '', status: d.status, photos: d.photos })),
  };
  return { trip, values };
}

async function fuelTotals(tripId: string) {
  const [row] = await db
    .select({
      n: sql<number>`count(*)::int`,
      litres: sql<number>`coalesce(sum(${schema.fuelEntries.litres}), 0)::float8`,
      cost: sql<number>`coalesce(sum(${schema.fuelEntries.total_cost}), 0)::float8`,
    })
    .from(schema.fuelEntries)
    .where(eq(schema.fuelEntries.trip_id, tripId));
  return { n: row?.n ?? 0, litres: row?.litres ?? 0, cost: row?.cost ?? 0 };
}

/** Parse the JSON payload the edit form posts. Anything malformed comes back as null. */
export function parseTripEdit(form: FormData): TripEditValues | null {
  try {
    const v = JSON.parse(String(form.get('payload') ?? ''));
    if (!v || typeof v.tripId !== 'string' || !Array.isArray(v.drops)) return null;
    const s = (x: unknown) => (typeof x === 'string' ? x.trim() : '');
    return {
      tripId: v.tripId,
      date: s(v.date),
      vehicleId: s(v.vehicleId),
      loadingAddress: s(v.loadingAddress),
      loadTonnes: s(v.loadTonnes),
      loadBales: s(v.loadBales),
      fuelLitres: s(v.fuelLitres),
      fuelCost: s(v.fuelCost),
      startOdometer: s(v.startOdometer),
      endOdometer: s(v.endOdometer),
      drops: v.drops.map((d: Record<string, unknown>) => ({
        id: typeof d.id === 'string' && d.id ? d.id : null,
        address: s(d.address),
        po: s(d.po),
        signee: s(d.signee),
        status: s(d.status) as DropStatus,
        photos: 0,
      })),
    };
  } catch {
    return null;
  }
}

/** Blank → null, otherwise a non-negative number; NaN marks bad input. */
const num = (s: string) => {
  if (!s) return null;
  const n = Number(s.replace(/,/g, ''));
  return Number.isFinite(n) && n >= 0 ? n : NaN;
};

export async function applyTripEdit(
  input: TripEditValues,
  actor: SessionUser,
  editor: EditorKind,
): Promise<{ error: string } | { ok: true }> {
  const loaded = await loadTripEditValues(input.tripId);
  if (!loaded) return { error: 'Trip not found' };
  const { trip, values: before } = loaded;
  const isOffice = editor === 'office';

  // ---- validate ----
  const tonnes = num(input.loadTonnes);
  const bales = num(input.loadBales);
  const litres = num(input.fuelLitres);
  const cost = isOffice ? num(input.fuelCost) : null;
  const startOdo = isOffice ? num(input.startOdometer) : trip.start_odometer_km != null ? Number(trip.start_odometer_km) : null;
  const endOdo = num(input.endOdometer);
  if ([tonnes, bales, litres, cost, startOdo, endOdo].some((n) => Number.isNaN(n))) return { error: 'Numbers only, and not negative' };
  if (startOdo != null && endOdo != null && endOdo < startOdo) {
    return { error: `Closing odometer (${endOdo}) is lower than the opening reading (${startOdo}). Check the number.` };
  }
  if (isOffice && trip.status === 'completed' && litres && litres > 0 && (cost == null || cost <= 0)) {
    return { error: 'Enter what the fuel cost (Ksh) - this trip is already approved' };
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date)) return { error: 'That date looks wrong' };
  if (input.date > nairobiDay(new Date())) return { error: "The date can't be in the future" };

  if (input.vehicleId !== trip.vehicle_id && !(await vehicleIsUsable(input.vehicleId))) {
    return { error: 'That vehicle is not available' };
  }

  const drops = input.drops.filter((d) => d.address || d.po || d.id);
  if (drops.length === 0) return { error: 'A trip needs at least one stop' };
  const allowed: readonly string[] = isOffice ? DROP_STATUSES : ['delivered', 'failed'];
  const existing = new Map(before.drops.map((d) => [d.id!, d]));
  for (const [i, d] of drops.entries()) {
    if (!d.address) return { error: `Stop ${i + 1} needs a name` };
    if (d.id && !existing.has(d.id)) return { error: 'A stop in the form no longer exists - reload the page' };
    const keepsOldStatus = d.id && existing.get(d.id)!.status === d.status;
    if (!allowed.includes(d.status) && !keepsOldStatus) return { error: `Stop ${i + 1} has an unknown status` };
  }
  if (!isOffice) {
    const needPo = drops.map((d, i) => (d.status !== 'failed' && !d.po ? i + 1 : 0)).filter(Boolean);
    if (needPo.length > 0) return { error: `Add the PO number for stop${needPo.length > 1 ? 's' : ''} ${needPo.join(', ')}` };
  }
  const seenPo = new Map<string, number>();
  for (const [i, d] of drops.entries()) {
    if (!d.po) continue;
    const key = d.po.toLowerCase();
    if (seenPo.has(key)) return { error: `PO ${d.po} is on stops ${seenPo.get(key)! + 1} and ${i + 1} - each stop has its own PO` };
    seenPo.set(key, i);
    const owner = await poOwner(db, d.po, trip.id);
    if (owner) return { error: `PO ${d.po} is already logged on ${owner.tripRef} by ${owner.driver}` };
  }

  const keptIds = new Set(drops.map((d) => d.id).filter(Boolean) as string[]);
  const removed = before.drops.filter((d) => !keptIds.has(d.id!));
  if (!isOffice) {
    const withPhoto = removed.find((d) => d.photos > 0);
    if (withPhoto) return { error: `"${withPhoto.address}" already has a PO photo - only the office can remove it` };
  }

  // ---- write ----
  // Shift the trip's times by whole days when the date changes, keeping the time of day.
  let startedAt = trip.started_at;
  let endedAt = trip.ended_at;
  if (input.date !== before.date) {
    const shift = Date.parse(`${input.date}T00:00:00Z`) - Date.parse(`${before.date}T00:00:00Z`);
    startedAt = startedAt ? new Date(startedAt.getTime() + shift) : new Date(`${input.date}T12:00:00`);
    endedAt = endedAt ? new Date(endedAt.getTime() + shift) : startedAt;
  }

  await db
    .update(schema.trips)
    .set({
      vehicle_id: input.vehicleId,
      loading_point_address: input.loadingAddress || 'Not recorded',
      load_tonnes: tonnes != null ? String(tonnes) : null,
      load_bales: bales != null ? Math.round(bales) : null,
      start_odometer_km: startOdo != null ? String(startOdo) : null,
      end_odometer_km: endOdo != null ? String(endOdo) : null,
      started_at: startedAt,
      ended_at: endedAt,
      updated_at: new Date(),
    })
    .where(eq(schema.trips.id, trip.id));
  if (endOdo != null) {
    await db.execute(sql`update bigventures.vehicles set odometer_km = greatest(odometer_km, ${endOdo}) where id = ${input.vehicleId}`);
  }

  // Drops. (trip_id, sequence) is unique and there's no transaction over HTTP, so:
  // delete the removed ones, park the kept ones on high sequences, then renumber.
  if (removed.length > 0) {
    await db.delete(schema.drops).where(and(eq(schema.drops.trip_id, trip.id), inArray(schema.drops.id, removed.map((d) => d.id!))));
  }
  const completedAt = endedAt ?? startedAt ?? new Date();
  for (const [i, d] of drops.entries()) {
    if (!d.id) continue;
    const old = existing.get(d.id)!;
    await db
      .update(schema.drops)
      .set({
        sequence: 10_000 + i,
        destination_address: d.address,
        po_number: d.po || null,
        signee_name: d.signee || null,
        status: d.status,
        ...(old.status !== d.status && d.status !== 'pending' && d.status !== 'arrived'
          ? { completed_at: sql`coalesce(${schema.drops.completed_at}, ${completedAt})` }
          : {}),
        ...(d.status === 'delivered' ? { issue_category: null, issue_notes: null } : {}),
        updated_at: new Date(),
      })
      .where(eq(schema.drops.id, d.id));
  }
  for (const [i, d] of drops.entries()) {
    if (d.id) await db.update(schema.drops).set({ sequence: i + 1 }).where(eq(schema.drops.id, d.id));
  }
  const added = drops.map((d, i) => ({ d, i })).filter(({ d }) => !d.id);
  if (added.length > 0) {
    await db.insert(schema.drops).values(
      added.map(({ d, i }) => ({
        trip_id: trip.id,
        sequence: i + 1,
        destination_address: d.address,
        po_number: d.po || null,
        signee_name: d.signee || null,
        status: d.status,
        completed_at: d.status === 'pending' || d.status === 'arrived' ? null : completedAt,
        geofence_skipped: true,
      })),
    );
  }

  // Fuel: only rewritten when the numbers actually changed, so receipts logged
  // on the road aren't thrown away by an edit that didn't touch fuel.
  const fuelBefore = await fuelTotals(trip.id);
  const litresChanged = (litres ?? 0) !== fuelBefore.litres;
  const costChanged = isOffice && (cost ?? 0) !== fuelBefore.cost;
  if (litresChanged || costChanged) {
    await db.delete(schema.fuelEntries).where(eq(schema.fuelEntries.trip_id, trip.id));
    if (litres && litres > 0) {
      const total = isOffice && cost ? cost : 0;
      await db.insert(schema.fuelEntries).values({
        vehicle_id: input.vehicleId,
        driver_id: trip.driver_id,
        trip_id: trip.id,
        litres: String(litres),
        unit_price: total ? String(Math.round((total / litres) * 100) / 100) : null,
        total_cost: String(total),
        odometer_km: null,
        filled_at: startedAt ?? new Date(),
        source: 'dashboard',
        created_by: actor.id,
        notes: isOffice ? 'Corrected by office' : 'Litres corrected by driver; cost added at approval',
      });
    }
  } else if (input.vehicleId !== trip.vehicle_id && fuelBefore.n > 0) {
    await db.update(schema.fuelEntries).set({ vehicle_id: input.vehicleId }).where(eq(schema.fuelEntries.trip_id, trip.id));
  }

  await writeAudit(actor, 'update', 'trip', trip.id, { ...before, status: trip.status }, { ...input, by: editor });
  return { ok: true };
}
