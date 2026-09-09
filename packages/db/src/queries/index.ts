/**
 * Hand-written aggregate queries that back the dashboard analytics views.
 * Kept here (not in the Next.js app) so they can be reused by background jobs.
 * Each returns plain numbers, not numeric strings. Uses the Drizzle query
 * builder so everything is automatically qualified with the `bigventures`
 * schema.
 */
import { sql, and, eq, gte, lt } from 'drizzle-orm';
import type { DB } from '../index';
import { vehicles, fuelEntries } from '../schema';

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
  const rows = await db
    .select({
      vehicleId: vehicles.id,
      registration: vehicles.registration,
      litres: sql<string>`coalesce(sum(${fuelEntries.litres}), 0)`,
      fuelCost: sql<string>`coalesce(sum(${fuelEntries.total_cost}), 0)`,
      odoMin: sql<string | null>`min(${fuelEntries.odometer_km})`,
      odoMax: sql<string | null>`max(${fuelEntries.odometer_km})`,
    })
    .from(vehicles)
    .leftJoin(
      fuelEntries,
      and(
        eq(fuelEntries.vehicle_id, vehicles.id),
        gte(fuelEntries.filled_at, from),
        lt(fuelEntries.filled_at, to),
      ),
    )
    .groupBy(vehicles.id, vehicles.registration)
    .orderBy(vehicles.registration);

  return rows.map((r) => {
    const litres = money(r.litres);
    const distanceKm = Math.max(0, money(r.odoMax) - money(r.odoMin));
    return {
      vehicleId: r.vehicleId,
      registration: r.registration,
      litres,
      distanceKm,
      litresPer100Km: distanceKm > 0 && litres > 0 ? (litres / distanceKm) * 100 : null,
      fuelCost: money(r.fuelCost),
    };
  });
}
