import { sql, eq, and, gte, lt, desc } from 'drizzle-orm';
import type { DB } from '../index';
import {
  vehicles,
  drivers,
  trips,
  fuelEntries,
  costEntries,
  advances,
  invoices,
  invoiceLines,
  clients,
  routes,
} from '../schema';
import { money, monthsBetween, pageBounds, paged, type Period, type PageArgs, type Paged } from './_util';
import { baseline, isConsumptionAnomaly } from '@bv/core/calc';

// ---- Fuel ------------------------------------------------------------

export interface FuelVehicleRow {
  vehicleId: string;
  registration: string;
  litres: number;
  distanceKm: number;
  litresPer100Km: number | null;
  costPerKm: number | null;
  fuelCost: number;
  fills: number;
}

export async function fuelByVehicle(db: DB, p: Period): Promise<FuelVehicleRow[]> {
  const rows = await db
    .select({
      vehicleId: vehicles.id,
      registration: vehicles.registration,
      litres: sql<string>`coalesce(sum(${fuelEntries.litres}),0)`,
      fuelCost: sql<string>`coalesce(sum(${fuelEntries.total_cost}),0)`,
      fills: sql<number>`count(${fuelEntries.id})::int`,
      odoMin: sql<string | null>`min(${fuelEntries.odometer_km})`,
      odoMax: sql<string | null>`max(${fuelEntries.odometer_km})`,
    })
    .from(vehicles)
    .leftJoin(
      fuelEntries,
      and(
        eq(fuelEntries.vehicle_id, vehicles.id),
        gte(fuelEntries.filled_at, p.from),
        lt(fuelEntries.filled_at, p.to),
      ),
    )
    .groupBy(vehicles.id, vehicles.registration)
    .orderBy(vehicles.registration);

  return rows.map((r) => {
    const litres = money(r.litres);
    const distanceKm = Math.max(0, money(r.odoMax) - money(r.odoMin));
    const cost = money(r.fuelCost);
    return {
      vehicleId: r.vehicleId,
      registration: r.registration,
      litres,
      distanceKm,
      litresPer100Km: distanceKm > 0 && litres > 0 ? (litres / distanceKm) * 100 : null,
      costPerKm: distanceKm > 0 ? cost / distanceKm : null,
      fuelCost: cost,
      fills: r.fills,
    };
  });
}

export interface FuelAnomaly {
  tripId: string;
  ref: string;
  vehicle: string;
  driver: string;
  filledAt: Date | null;
  litresPer100Km: number;
  reason: string;
}

/** Per-trip L/100km vs each vehicle's historical baseline. */
export async function fuelAnomalies(db: DB, p: Period): Promise<FuelAnomaly[]> {
  const rows = await db
    .select({
      tripId: trips.id,
      ref: trips.reference_code,
      vehicleId: trips.vehicle_id,
      vehicle: vehicles.registration,
      driver: drivers.full_name,
      filledAt: fuelEntries.filled_at,
      litres: fuelEntries.litres,
      startOdo: trips.start_odometer_km,
      endOdo: trips.end_odometer_km,
    })
    .from(fuelEntries)
    .innerJoin(trips, eq(trips.id, fuelEntries.trip_id))
    .leftJoin(vehicles, eq(vehicles.id, trips.vehicle_id))
    .leftJoin(drivers, eq(drivers.id, trips.driver_id))
    .orderBy(desc(fuelEntries.filled_at));

  const perVehicle = new Map<string, number[]>();
  const points = rows.map((r) => {
    const km = money(r.endOdo) - money(r.startOdo);
    const l100 = km > 0 ? (money(r.litres) / km) * 100 : null;
    if (l100 && l100 > 0 && l100 < 120) {
      (perVehicle.get(r.vehicleId) ?? perVehicle.set(r.vehicleId, []).get(r.vehicleId)!).push(l100);
    }
    return { ...r, l100 };
  });

  const out: FuelAnomaly[] = [];
  for (const pt of points) {
    if (!pt.l100 || !pt.filledAt) continue;
    if (pt.filledAt < p.from || pt.filledAt >= p.to) continue;
    const b = baseline(perVehicle.get(pt.vehicleId) ?? []);
    const v = isConsumptionAnomaly(pt.l100, b);
    if (v.isAnomaly && v.reason) {
      out.push({
        tripId: pt.tripId,
        ref: pt.ref,
        vehicle: pt.vehicle ?? '—',
        driver: pt.driver ?? '—',
        filledAt: pt.filledAt,
        litresPer100Km: Math.round(pt.l100 * 10) / 10,
        reason: v.reason,
      });
    }
  }
  return out;
}

// ---- Costs ----------------------------------------------------------

export async function costsByCategory(db: DB, p: Period) {
  const rows = await db
    .select({
      category: costEntries.category,
      total: sql<string>`sum(${costEntries.amount})`,
      count: sql<number>`count(*)::int`,
    })
    .from(costEntries)
    .where(and(gte(costEntries.incurred_at, p.from.toISOString().slice(0, 10)), lt(costEntries.incurred_at, p.to.toISOString().slice(0, 10))))
    .groupBy(costEntries.category)
    .orderBy(sql`sum(${costEntries.amount}) desc`);
  return rows.map((r) => ({ category: r.category, total: money(r.total), count: r.count }));
}

export async function costSummary(db: DB, p: Period) {
  const [r] = await db
    .select({
      total: sql<string>`coalesce(sum(${costEntries.amount}),0)`,
      pendingCount: sql<number>`count(*) filter (where ${costEntries.status} = 'pending')::int`,
      pendingAmount: sql<string>`coalesce(sum(${costEntries.amount}) filter (where ${costEntries.status} = 'pending'),0)`,
    })
    .from(costEntries)
    .where(
      and(
        gte(costEntries.incurred_at, p.from.toISOString().slice(0, 10)),
        lt(costEntries.incurred_at, p.to.toISOString().slice(0, 10)),
      ),
    );
  return {
    total: money(r?.total),
    pendingCount: r?.pendingCount ?? 0,
    pendingAmount: money(r?.pendingAmount),
  };
}

export async function costEntryList(
  db: DB,
  f: { vehicleId?: string; driverId?: string; category?: string; from?: Date; to?: Date } & PageArgs = {},
) {
  const conds = [];
  if (f.vehicleId) conds.push(eq(costEntries.vehicle_id, f.vehicleId));
  if (f.driverId) conds.push(eq(costEntries.driver_id, f.driverId));
  if (f.category) conds.push(eq(costEntries.category, f.category as 'repair'));
  if (f.from) conds.push(gte(costEntries.incurred_at, f.from.toISOString().slice(0, 10)));
  if (f.to) conds.push(lt(costEntries.incurred_at, f.to.toISOString().slice(0, 10)));
  const where = conds.length ? and(...conds) : undefined;
  const b = pageBounds(f);
  const [{ total } = { total: 0 }] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(costEntries)
    .where(where);

  const rows = await db
    .select({
      id: costEntries.id,
      category: costEntries.category,
      amount: costEntries.amount,
      incurredAt: costEntries.incurred_at,
      description: costEntries.description,
      vendor: costEntries.vendor,
      status: costEntries.status,
      vehicle: vehicles.registration,
      driver: drivers.full_name,
    })
    .from(costEntries)
    .leftJoin(vehicles, eq(vehicles.id, costEntries.vehicle_id))
    .leftJoin(drivers, eq(drivers.id, costEntries.driver_id))
    .where(where)
    .orderBy(desc(costEntries.incurred_at))
    .limit(b.limit)
    .offset(b.offset);
  return paged(
    rows.map((r) => ({ ...r, amount: money(r.amount) })),
    total,
    b.page,
    b.pageSize,
  );
}

// ---- Advances -----------------------------------------------------

export async function advanceLedger(db: DB) {
  const rows = await db
    .select({
      driverId: drivers.id,
      driver: drivers.full_name,
      balance: drivers.advance_balance,
      lossBalance: drivers.loss_balance,
      disbursed: sql<string>`coalesce(sum(${advances.amount}) filter (where ${advances.direction} = 'disbursed'),0)`,
      repaid: sql<string>`coalesce(sum(${advances.amount}) filter (where ${advances.direction} in ('repaid','written_off')),0)`,
      lastActivity: sql<string | null>`max(${advances.issued_at})`,
    })
    .from(drivers)
    .leftJoin(advances, eq(advances.driver_id, drivers.id))
    .groupBy(drivers.id, drivers.full_name, drivers.advance_balance, drivers.loss_balance)
    .orderBy(desc(drivers.advance_balance));
  return rows.map((r) => ({
    driverId: r.driverId,
    driver: r.driver,
    balance: money(r.balance),
    lossBalance: money(r.lossBalance),
    disbursed: money(r.disbursed),
    repaid: money(r.repaid),
    lastActivity: r.lastActivity,
  }));
}

export async function advancesForDriver(db: DB, driverId: string) {
  return db
    .select()
    .from(advances)
    .where(eq(advances.driver_id, driverId))
    .orderBy(desc(advances.issued_at));
}

// ---- ROI ---------------------------------------------------------

export interface VehicleRoiRow {
  vehicleId: string;
  registration: string;
  revenue: number;
  fuelCost: number;
  runningCost: number;
  overhead: number;
  netContribution: number;
  marginPct: number | null;
  tripCount: number;
  distanceKm: number;
  costPerKm: number | null;
}

export async function vehicleRoiTable(db: DB, p: Period): Promise<VehicleRoiRow[]> {
  const months = monthsBetween(p.from, p.to);
  const from = p.from.toISOString();
  const to = p.to.toISOString();
  const fromD = p.from.toISOString().slice(0, 10);
  const toD = p.to.toISOString().slice(0, 10);

  const result = await db.execute(sql`
    select
      v.id as vehicle_id,
      v.registration,
      v.monthly_finance_cost as monthly_finance,
      coalesce((
        select sum(il.line_total::numeric) from bigventures.invoice_lines il
        join bigventures.trips t2 on t2.id = il.trip_id
        where t2.vehicle_id = v.id and t2.started_at >= ${from} and t2.started_at < ${to}
      ), 0) as revenue,
      coalesce((
        select sum(fe.total_cost::numeric) from bigventures.fuel_entries fe
        where fe.vehicle_id = v.id and fe.filled_at >= ${from} and fe.filled_at < ${to}
      ), 0) as fuel_cost,
      coalesce((
        select sum(ce.amount::numeric) from bigventures.cost_entries ce
        where ce.vehicle_id = v.id and ce.incurred_at >= ${fromD} and ce.incurred_at < ${toD}
      ), 0) as running_cost,
      (select count(*)::int from bigventures.trips t
        where t.vehicle_id = v.id and t.started_at >= ${from} and t.started_at < ${to}) as trip_count,
      coalesce((
        select sum(greatest(coalesce(t.end_odometer_km::numeric,0) - coalesce(t.start_odometer_km::numeric,0), 0))
        from bigventures.trips t where t.vehicle_id = v.id and t.started_at >= ${from} and t.started_at < ${to}
      ), 0) as distance_km
    from bigventures.vehicles v
    order by v.registration
  `);
  const rows = (result.rows ?? result) as {
    vehicle_id: string;
    registration: string;
    monthly_finance: string;
    revenue: string;
    fuel_cost: string;
    running_cost: string;
    trip_count: number;
    distance_km: string;
  }[];

  return rows.map((r) => {
    const revenue = money(r.revenue);
    const fuelCost = money(r.fuel_cost);
    const runningCost = money(r.running_cost);
    const overhead = money(r.monthly_finance) * months;
    const netContribution = revenue - fuelCost - runningCost - overhead;
    const distanceKm = money(r.distance_km);
    return {
      vehicleId: r.vehicle_id,
      registration: r.registration,
      revenue,
      fuelCost,
      runningCost,
      overhead,
      netContribution,
      marginPct: revenue > 0 ? (netContribution / revenue) * 100 : null,
      tripCount: r.trip_count,
      distanceKm,
      costPerKm: distanceKm > 0 ? (fuelCost + runningCost + overhead) / distanceKm : null,
    };
  });
}

// ---- Route analytics -------------------------------------------

export async function routeAnalytics(db: DB, p: Period) {
  const rows = await db
    .select({
      routeId: trips.route_id,
      routeName: routes.name,
      trips: sql<number>`count(*)::int`,
      avgFuel: sql<string>`coalesce(avg((select sum(fe.total_cost) from ${fuelEntries} fe where fe.trip_id = ${trips.id})),0)`,
      minFuel: sql<string>`coalesce(min((select sum(fe.total_cost) from ${fuelEntries} fe where fe.trip_id = ${trips.id})),0)`,
      maxFuel: sql<string>`coalesce(max((select sum(fe.total_cost) from ${fuelEntries} fe where fe.trip_id = ${trips.id})),0)`,
      avgDistanceKm: sql<string>`coalesce(avg(greatest(coalesce(${trips.end_odometer_km},0)-coalesce(${trips.start_odometer_km},0),0)),0)`,
      avgDurationMin: sql<string>`coalesce(avg(extract(epoch from (${trips.ended_at} - ${trips.started_at}))/60),0)`,
    })
    .from(trips)
    .leftJoin(routes, eq(routes.id, trips.route_id))
    .where(and(gte(trips.started_at, p.from), lt(trips.started_at, p.to)))
    .groupBy(trips.route_id, routes.name)
    .orderBy(sql`count(*) desc`);

  return rows.map((r) => ({
    routeId: r.routeId,
    routeName: r.routeName ?? 'Ad-hoc / unassigned',
    trips: r.trips,
    avgFuel: money(r.avgFuel),
    minFuel: money(r.minFuel),
    maxFuel: money(r.maxFuel),
    avgDistanceKm: money(r.avgDistanceKm),
    avgDurationMin: money(r.avgDurationMin),
  }));
}

// ---- Invoicing -------------------------------------------------

export async function invoiceList(db: DB, args: PageArgs = {}) {
  const b = pageBounds({ pageSize: 20, ...args });
  const [{ total } = { total: 0 }] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(invoices);
  const rows = await db
    .select({
      id: invoices.id,
      number: invoices.invoice_number,
      client: clients.name,
      status: invoices.status,
      issueDate: invoices.issue_date,
      dueDate: invoices.due_date,
      total: invoices.total,
      amountPaid: invoices.amount_paid,
      hasIssues: invoices.has_unresolved_issues,
      lines: sql<number>`(select count(*)::int from ${invoiceLines} where ${invoiceLines.invoice_id} = ${invoices.id})`,
    })
    .from(invoices)
    .leftJoin(clients, eq(clients.id, invoices.client_id))
    .orderBy(desc(invoices.issue_date))
    .limit(b.limit)
    .offset(b.offset);
  return paged(
    rows.map((r) => ({
      ...r,
      total: money(r.total),
      amountPaid: money(r.amountPaid),
      outstanding: money(r.total) - money(r.amountPaid),
      overdue:
        !!r.dueDate && r.status !== 'paid' && r.status !== 'void' && new Date(r.dueDate) < new Date(),
    })),
    total,
    b.page,
    b.pageSize,
  );
}

/** Small summary for the invoicing page header (all invoices, not just a page). */
export async function invoiceSummary(db: DB) {
  const [r] = await db
    .select({
      outstanding: sql<string>`coalesce(sum(${invoices.total} - ${invoices.amount_paid}),0)`,
      overdue: sql<string>`coalesce(sum(${invoices.total} - ${invoices.amount_paid}) filter (where ${invoices.due_date} < now() and ${invoices.status} not in ('paid','void')),0)`,
      flagged: sql<number>`count(*) filter (where ${invoices.has_unresolved_issues})::int`,
      count: sql<number>`count(*)::int`,
    })
    .from(invoices);
  return {
    outstanding: money(r?.outstanding),
    overdue: money(r?.overdue),
    flagged: r?.flagged ?? 0,
    count: r?.count ?? 0,
  };
}

/** Delivered trips with a valid POD that aren't on any invoice line yet. */
export async function unbilledTrips(db: DB) {
  const result = await db.execute(sql`
    select t.id, t.reference_code as ref, c.name as client, t.started_at,
      v.registration as vehicle,
      (select count(*)::int from bigventures.drops d
        where d.trip_id = t.id and d.status in ('delivered','partial')) as delivered_drops
    from bigventures.trips t
    left join bigventures.clients c on c.id = t.client_id
    left join bigventures.vehicles v on v.id = t.vehicle_id
    where t.status = 'completed'
      and not exists (select 1 from bigventures.invoice_lines il where il.trip_id = t.id)
      and exists (select 1 from bigventures.drops d where d.trip_id = t.id and d.status = 'delivered')
    order by t.started_at desc
    limit 200
  `);
  const rows = (result.rows ?? result) as {
    id: string;
    ref: string;
    client: string | null;
    started_at: string;
    vehicle: string | null;
    delivered_drops: number;
  }[];
  return rows.map((r) => ({
    id: r.id,
    ref: r.ref,
    client: r.client,
    startedAt: r.started_at ? new Date(r.started_at) : null,
    vehicle: r.vehicle,
    deliveredDrops: r.delivered_drops,
  }));
}

export async function financeSummary(db: DB, p: Period) {
  const [rev] = await db
    .select({ total: sql<string>`coalesce(sum(${invoiceLines.line_total}),0)` })
    .from(invoiceLines)
    .innerJoin(trips, eq(trips.id, invoiceLines.trip_id))
    .where(and(gte(trips.started_at, p.from), lt(trips.started_at, p.to)));
  const [fuel] = await db
    .select({ total: sql<string>`coalesce(sum(${fuelEntries.total_cost}),0)` })
    .from(fuelEntries)
    .where(and(gte(fuelEntries.filled_at, p.from), lt(fuelEntries.filled_at, p.to)));
  const [cost] = await db
    .select({ total: sql<string>`coalesce(sum(${costEntries.amount}),0)` })
    .from(costEntries)
    .where(
      and(
        gte(costEntries.incurred_at, p.from.toISOString().slice(0, 10)),
        lt(costEntries.incurred_at, p.to.toISOString().slice(0, 10)),
      ),
    );
  const [ar] = await db
    .select({
      outstanding: sql<string>`coalesce(sum(${invoices.total} - ${invoices.amount_paid}),0)`,
      overdue: sql<string>`coalesce(sum(${invoices.total} - ${invoices.amount_paid}) filter (where ${invoices.due_date} < now() and ${invoices.status} not in ('paid','void')),0)`,
    })
    .from(invoices);
  return {
    revenue: money(rev?.total),
    fuelCost: money(fuel?.total),
    runningCost: money(cost?.total),
    receivablesOutstanding: money(ar?.outstanding),
    receivablesOverdue: money(ar?.overdue),
  };
}
