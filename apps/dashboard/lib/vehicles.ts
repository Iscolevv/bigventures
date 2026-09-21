import { db, sql } from '@bv/db';

/** Trucks are shared in practice, so any active vehicle is usable; the one assigned to the driver (if any) is listed first. */
export async function vehiclesForDriver(driverId: string): Promise<{ id: string; reg: string; mine: boolean }[]> {
  const res = await db.execute(sql`
    select v.id, v.registration as reg, (a.id is not null) as mine
    from bigventures.vehicles v
    left join bigventures.vehicle_assignments a
      on a.vehicle_id = v.id and a.driver_id = ${driverId} and a.end_date is null
    where v.status = 'active'
    order by mine desc, v.registration`);
  return (res.rows as { id: string; reg: string; mine: boolean }[]).map((r) => ({ id: r.id, reg: r.reg, mine: !!r.mine }));
}

export async function vehicleIsUsable(vehicleId: string): Promise<boolean> {
  const res = await db.execute(sql`select 1 from bigventures.vehicles where id = ${vehicleId} and status = 'active' limit 1`);
  return res.rows.length > 0;
}
