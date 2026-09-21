import { sql } from 'drizzle-orm';
import type { DB } from '../index';

export interface DailyRow {
  date: string;
  vehicle: string;
  driver: string;
  trip: string;
  tripId: string;
  stopNo: number;
  po: string | null;
  stop: string;
  status: string;
  tonnes: number | null;
  bales: number | null;
  fuelLitres: number | null;
  fuelCost: number | null;
  poPhotos: number;
}

/**
 * One row per drop between two Nairobi calendar days (inclusive), in the order
 * the office's daily Excel sheet is kept: by day, vehicle, then stop. Load and
 * fuel sit on the first stop of each trip only so sums are not double counted.
 */
export async function dailyRows(db: DB, from: string, to: string): Promise<DailyRow[]> {
  const res = await db.execute(sql`
    select (t.started_at + interval '3 hours')::date::text as date,
      v.registration as vehicle, dr.full_name as driver,
      t.reference_code as trip, t.id as trip_id, d.sequence as stop_no,
      d.po_number as po, d.destination_address as stop, d.status,
      case when d.sequence = 1 then t.load_tonnes end as tonnes,
      case when d.sequence = 1 then t.load_bales end as bales,
      case when d.sequence = 1 then (select sum(fe.litres) from bigventures.fuel_entries fe where fe.trip_id = t.id) end as fuel_litres,
      case when d.sequence = 1 then (select sum(fe.total_cost) from bigventures.fuel_entries fe where fe.trip_id = t.id) end as fuel_cost,
      (select count(*)::int from bigventures.pod_photos pp where pp.drop_id = d.id) as po_photos
    from bigventures.drops d
    join bigventures.trips t on t.id = d.trip_id
    join bigventures.vehicles v on v.id = t.vehicle_id
    join bigventures.drivers dr on dr.id = t.driver_id
    where (t.started_at + interval '3 hours')::date between ${from}::date and ${to}::date
    order by date, v.registration, t.created_at, d.sequence`);
  const num = (x: unknown) => (x == null ? null : Number(x));
  return (res.rows as Record<string, unknown>[]).map((r) => ({
    date: r.date as string,
    vehicle: r.vehicle as string,
    driver: r.driver as string,
    trip: r.trip as string,
    tripId: r.trip_id as string,
    stopNo: Number(r.stop_no),
    po: (r.po as string | null) ?? null,
    stop: r.stop as string,
    status: r.status as string,
    tonnes: num(r.tonnes),
    bales: num(r.bales),
    fuelLitres: num(r.fuel_litres),
    fuelCost: num(r.fuel_cost),
    poPhotos: Number(r.po_photos),
  }));
}
