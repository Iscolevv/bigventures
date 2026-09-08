/**
 * Hand-written aggregate queries that back the dashboard analytics views.
 * Kept here (not in the Next.js app) so they can be unit-tested and reused by
 * background jobs. Each returns plain numbers, not numeric strings.
 */
import { sql } from 'drizzle-orm';
import type { DB } from '../index';

/** Drizzle returns numeric(x,y) as string — coerce at the boundary. */
export const money = (v: string | number | null | undefined): number =>
  v == null ? 0 : typeof v === 'number' ? v : Number(v);

export interface FuelConsumptionRow {
  vehicleId: string;
  registration: string;
  litres: number;
  distanceKm: number;
  litresPer100Km: number | null;
  fuelCost: number;
}

/**
 * Per-vehicle fuel consumption over a window, using odometer deltas between
 * the first and last fill in the window.
 */
export async function fuelConsumptionByVehicle(
  db: DB,
  from: Date,
  to: Date,
): Promise<FuelConsumptionRow[]> {
  type Raw = {
    vehicle_id: string;
    registration: string;
    litres: string;
    fuel_cost: string;
    odo_min: string;
    odo_max: string;
  };
  const result = await db.execute(sql`
    select
      v.id                as vehicle_id,
      v.registration      as registration,
      coalesce(sum(f.litres), 0)      as litres,
      coalesce(sum(f.total_cost), 0)  as fuel_cost,
      min(f.odometer_km)  as odo_min,
      max(f.odometer_km)  as odo_max
    from vehicles v
    left join fuel_entries f
      on f.vehicle_id = v.id
      and f.filled_at >= ${from.toISOString()}
      and f.filled_at <  ${to.toISOString()}
    group by v.id, v.registration
    order by v.registration
  `);

  const rows = result.rows as unknown as Raw[];
  return rows.map((r) => {
    const litres = money(r.litres);
    const distanceKm = Math.max(0, money(r.odo_max) - money(r.odo_min));
    return {
      vehicleId: r.vehicle_id,
      registration: r.registration,
      litres,
      distanceKm,
      litresPer100Km: distanceKm > 0 && litres > 0 ? (litres / distanceKm) * 100 : null,
      fuelCost: money(r.fuel_cost),
    };
  });
}
