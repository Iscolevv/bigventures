import { sql } from 'drizzle-orm';
import type { DB } from '../index';
import { pageBounds, paged, type PageArgs, type Paged } from './_util';

export type PoFilter = 'all' | 'missing' | 'overdue';

export interface PoRow {
  dropId: string;
  po: string | null;
  destination: string;
  status: string;
  tripId: string;
  tripRef: string;
  tripDate: Date | null;
  driverId: string;
  driver: string;
  vehicle: string;
  loggedAt: Date;
  photos: number;
  overdue: boolean;
}

/**
 * Every drop is one PO. Search by PO number, store, trip ref, driver or plate to
 * see who is responsible. "missing" = delivered with no photo yet; "overdue" =
 * missing and past the upload window.
 */
export async function poSearch(
  db: DB,
  f: { q?: string; filter?: PoFilter; windowHours: number } & PageArgs,
): Promise<Paged<PoRow>> {
  const b = pageBounds({ pageSize: 30, ...f });
  const term = f.q?.trim() ? `%${f.q.trim()}%` : null;
  const filter = f.filter ?? 'all';

  const where = sql`
    d.status in ('delivered','partial','failed','returned')
    ${term
      ? sql`and (d.po_number ilike ${term} or d.destination_address ilike ${term}
          or t.reference_code ilike ${term} or dr.full_name ilike ${term} or v.registration ilike ${term})`
      : sql``}
    ${filter === 'missing' || filter === 'overdue'
      ? sql`and d.status in ('delivered','partial') and not exists (select 1 from bigventures.pod_photos pp where pp.drop_id = d.id)`
      : sql``}
    ${filter === 'overdue' ? sql`and d.po_number is not null and d.created_at < now() - make_interval(hours => ${f.windowHours})` : sql``}
  `;

  const totalRes = await db.execute(sql`
    select count(*)::int as n
    from bigventures.drops d
    join bigventures.trips t on t.id = d.trip_id
    join bigventures.drivers dr on dr.id = t.driver_id
    join bigventures.vehicles v on v.id = t.vehicle_id
    where ${where}
  `);
  const total = (totalRes.rows[0] as { n: number } | undefined)?.n ?? 0;

  const res = await db.execute(sql`
    select d.id as drop_id, d.po_number as po, d.destination_address as destination, d.status,
      t.id as trip_id, t.reference_code as trip_ref, t.started_at as trip_date,
      dr.id as driver_id, dr.full_name as driver, v.registration as vehicle,
      d.created_at as logged_at,
      (select count(*)::int from bigventures.pod_photos pp where pp.drop_id = d.id) as photos,
      (d.status in ('delivered','partial') and d.po_number is not null
        and not exists (select 1 from bigventures.pod_photos pp where pp.drop_id = d.id)
        and d.created_at < now() - make_interval(hours => ${f.windowHours})) as overdue
    from bigventures.drops d
    join bigventures.trips t on t.id = d.trip_id
    join bigventures.drivers dr on dr.id = t.driver_id
    join bigventures.vehicles v on v.id = t.vehicle_id
    where ${where}
    order by d.created_at desc
    limit ${b.limit} offset ${b.offset}
  `);

  const rows = (res.rows as Record<string, unknown>[]).map((r) => ({
    dropId: r.drop_id as string,
    po: (r.po as string | null) ?? null,
    destination: r.destination as string,
    status: r.status as string,
    tripId: r.trip_id as string,
    tripRef: r.trip_ref as string,
    tripDate: r.trip_date ? new Date(r.trip_date as string) : null,
    driverId: r.driver_id as string,
    driver: r.driver as string,
    vehicle: r.vehicle as string,
    loggedAt: new Date(r.logged_at as string),
    photos: Number(r.photos),
    overdue: Boolean(r.overdue),
  }));
  return paged(rows, total, b.page, b.pageSize);
}

export interface PodBacklogItem {
  dropId: string;
  po: string | null;
  destination: string;
  tripRef: string;
  loggedAt: Date;
  dueAt: Date;
  overdue: boolean;
}

/** Delivered drops this driver still owes a PO photo for, oldest first. */
export async function driverPodBacklog(
  db: DB,
  driverId: string,
  windowHours: number,
): Promise<PodBacklogItem[]> {
  const res = await db.execute(sql`
    select d.id as drop_id, d.po_number as po, d.destination_address as destination,
      t.reference_code as trip_ref, d.created_at as logged_at,
      d.created_at + make_interval(hours => ${windowHours}) as due_at,
      (d.created_at < now() - make_interval(hours => ${windowHours})) as overdue
    from bigventures.drops d
    join bigventures.trips t on t.id = d.trip_id
    where t.driver_id = ${driverId}
      and d.status in ('delivered','partial')
      and d.po_number is not null -- drops logged before the PO rules existed are exempt from the block
      and not exists (select 1 from bigventures.pod_photos pp where pp.drop_id = d.id)
    order by d.created_at asc
  `);
  return (res.rows as Record<string, unknown>[]).map((r) => ({
    dropId: r.drop_id as string,
    po: (r.po as string | null) ?? null,
    destination: r.destination as string,
    tripRef: r.trip_ref as string,
    loggedAt: new Date(r.logged_at as string),
    dueAt: new Date(r.due_at as string),
    overdue: Boolean(r.overdue),
  }));
}

/** If this PO number is already on a drop, who logged it (for the duplicate message). */
export async function poOwner(db: DB, po: string) {
  const res = await db.execute(sql`
    select d.id as drop_id, t.reference_code as trip_ref, dr.full_name as driver
    from bigventures.drops d
    join bigventures.trips t on t.id = d.trip_id
    join bigventures.drivers dr on dr.id = t.driver_id
    where lower(d.po_number) = lower(${po})
    limit 1
  `);
  const r = res.rows[0] as { drop_id: string; trip_ref: string; driver: string } | undefined;
  return r ? { dropId: r.drop_id, tripRef: r.trip_ref, driver: r.driver } : null;
}
