import { sql } from 'drizzle-orm';
import type { DB } from '../index';

export async function pendingApprovalCount(db: DB): Promise<number> {
  const res = await db.execute(sql`select count(*)::int as n from bigventures.trips where status = 'submitted'`);
  return (res.rows[0] as { n: number } | undefined)?.n ?? 0;
}

export interface PendingDrop {
  id: string;
  sequence: number;
  po: string | null;
  destination: string;
  status: string;
  signee: string | null;
  photoKeys: string[];
}

export interface PendingTrip {
  id: string;
  ref: string;
  date: string;
  loggedAt: Date;
  driver: string;
  vehicle: string;
  tonnes: number | null;
  bales: number | null;
  fuelLitres: number | null;
  fuelCost: number | null;
  startOdometer: number | null;
  endOdometer: number | null;
  drops: PendingDrop[];
}

/** Trips a driver has logged that the office has not approved yet (oldest first). */
export async function pendingTrips(db: DB): Promise<PendingTrip[]> {
  const tripsRes = await db.execute(sql`
    select t.id, t.reference_code as ref, (t.started_at + interval '3 hours')::date::text as date,
      t.created_at as logged_at, dr.full_name as driver, v.registration as vehicle,
      t.load_tonnes as tonnes, t.load_bales as bales,
      t.start_odometer_km::float8 as start_odo, t.end_odometer_km::float8 as end_odo,
      (select sum(fe.litres) from bigventures.fuel_entries fe where fe.trip_id = t.id) as fuel_litres,
      (select sum(fe.total_cost) from bigventures.fuel_entries fe where fe.trip_id = t.id) as fuel_cost
    from bigventures.trips t
    join bigventures.drivers dr on dr.id = t.driver_id
    join bigventures.vehicles v on v.id = t.vehicle_id
    where t.status = 'submitted'
    order by t.created_at asc`);
  const trips = tripsRes.rows as Record<string, unknown>[];
  if (trips.length === 0) return [];

  const ids = trips.map((t) => t.id as string);
  const dropsRes = await db.execute(sql`
    select d.id, d.trip_id, d.sequence, d.po_number as po, d.destination_address as destination, d.status,
      d.signee_name as signee,
      coalesce((select array_agg(pp.storage_key order by pp.uploaded_at) from bigventures.pod_photos pp where pp.drop_id = d.id), '{}') as photo_keys
    from bigventures.drops d
    where d.trip_id in (${sql.join(ids.map((i) => sql`${i}`), sql`, `)})
    order by d.trip_id, d.sequence`);
  const drops = dropsRes.rows as Record<string, unknown>[];
  const num = (x: unknown) => (x == null ? null : Number(x));

  return trips.map((t) => ({
    id: t.id as string,
    ref: t.ref as string,
    date: t.date as string,
    loggedAt: new Date(t.logged_at as string),
    driver: t.driver as string,
    vehicle: t.vehicle as string,
    tonnes: num(t.tonnes),
    bales: num(t.bales),
    fuelLitres: num(t.fuel_litres),
    fuelCost: num(t.fuel_cost),
    startOdometer: num(t.start_odo),
    endOdometer: num(t.end_odo),
    drops: drops
      .filter((d) => d.trip_id === t.id)
      .map((d) => ({
        id: d.id as string,
        sequence: Number(d.sequence),
        po: (d.po as string | null) ?? null,
        destination: d.destination as string,
        status: d.status as string,
        signee: (d.signee as string | null) ?? null,
        photoKeys: (d.photo_keys as string[]) ?? [],
      })),
  }));
}
