import { sql, eq, and, gte, lt, desc } from 'drizzle-orm';
import type { DB } from '../index';
import {
  trips,
  drops,
  podPhotos,
  vehicles,
  drivers,
  routes,
  vehicleChecks,
  vehicleCheckItems,
  trailSegments,
  tripDeviations,
  fuelEntries,
  costEntries,
} from '../schema';
import { money, pageBounds, paged, type PageArgs, type Paged } from './_util';

export interface TripListFilter extends PageArgs {
  driverId?: string;
  vehicleId?: string;
  status?: string;
  from?: Date;
  to?: Date;
}

export interface TripListRow {
  id: string;
  ref: string;
  status: string;
  vehicle: string;
  driver: string;
  route: string | null;
  startedAt: Date | null;
  endedAt: Date | null;
  distanceKm: number;
  drops: number;
  issues: number;
  fuelCost: number;
}

export async function tripList(db: DB, f: TripListFilter = {}): Promise<Paged<TripListRow>> {
  const conds = [];
  if (f.driverId) conds.push(eq(trips.driver_id, f.driverId));
  if (f.vehicleId) conds.push(eq(trips.vehicle_id, f.vehicleId));
  if (f.status) conds.push(eq(trips.status, f.status as 'completed'));
  if (f.from) conds.push(gte(trips.started_at, f.from));
  if (f.to) conds.push(lt(trips.started_at, f.to));
  const where = conds.length ? and(...conds) : undefined;
  const b = pageBounds(f);

  const [{ total } = { total: 0 }] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(trips)
    .where(where);

  const rows = await db
    .select({
      id: trips.id,
      ref: trips.reference_code,
      status: trips.status,
      vehicle: vehicles.registration,
      driver: drivers.full_name,
      route: routes.name,
      startedAt: trips.started_at,
      endedAt: trips.ended_at,
      startOdo: trips.start_odometer_km,
      endOdo: trips.end_odometer_km,
      plannedM: trips.planned_distance_m,
      drops: sql<number>`(select count(*)::int from ${drops} where ${drops.trip_id} = ${trips.id})`,
      issues: sql<number>`(select count(*)::int from ${drops} where ${drops.trip_id} = ${trips.id} and ${drops.issue_category} is not null)`,
      fuelCost: sql<string>`(select coalesce(sum(${fuelEntries.total_cost}),0) from ${fuelEntries} where ${fuelEntries.trip_id} = ${trips.id})`,
    })
    .from(trips)
    .leftJoin(vehicles, eq(vehicles.id, trips.vehicle_id))
    .leftJoin(drivers, eq(drivers.id, trips.driver_id))
    .leftJoin(routes, eq(routes.id, trips.route_id))
    .where(where)
    .orderBy(desc(trips.started_at))
    .limit(b.limit)
    .offset(b.offset);

  const mapped = rows.map((r) => {
    const odoKm = money(r.endOdo) - money(r.startOdo);
    return {
      id: r.id,
      ref: r.ref,
      status: r.status,
      vehicle: r.vehicle ?? '—',
      driver: r.driver ?? '—',
      route: r.route,
      startedAt: r.startedAt,
      endedAt: r.endedAt,
      distanceKm: odoKm > 0 ? odoKm : r.plannedM ? r.plannedM / 1000 : 0,
      drops: r.drops,
      issues: r.issues,
      fuelCost: money(r.fuelCost),
    };
  });
  return paged(mapped, total, b.page, b.pageSize);
}

export async function tripDetail(db: DB, id: string) {
  const [trip] = await db
    .select({
      id: trips.id,
      ref: trips.reference_code,
      status: trips.status,
      vehicle: vehicles.registration,
      vehicleId: trips.vehicle_id,
      driver: drivers.full_name,
      driverId: trips.driver_id,
      route: routes.name,
      loadingAddress: trips.loading_point_address,
      loadingLat: trips.loading_lat,
      loadingLng: trips.loading_lng,
      plannedDistanceM: trips.planned_distance_m,
      plannedDurationS: trips.planned_duration_s,
      plannedPolyline: trips.planned_polyline,
      actualDistanceM: trips.actual_distance_m,
      startedAt: trips.started_at,
      endedAt: trips.ended_at,
      startOdo: trips.start_odometer_km,
      endOdo: trips.end_odometer_km,
      cargo: trips.cargo_description,
      notes: trips.notes,
    })
    .from(trips)
    .leftJoin(vehicles, eq(vehicles.id, trips.vehicle_id))
    .leftJoin(drivers, eq(drivers.id, trips.driver_id))
    .leftJoin(routes, eq(routes.id, trips.route_id))
    .where(eq(trips.id, id))
    .limit(1);
  if (!trip) return null;

  const dropRows = await db
    .select({
      id: drops.id,
      sequence: drops.sequence,
      address: drops.destination_address,
      lat: drops.dest_lat,
      lng: drops.dest_lng,
      status: drops.status,
      signee: drops.signee_name,
      issueCategory: drops.issue_category,
      issueNotes: drops.issue_notes,
      arrivedAt: drops.arrived_at,
      completedAt: drops.completed_at,
      geofenceEnteredAt: drops.geofence_entered_at,
      geofenceSkipped: drops.geofence_skipped,
      photos: sql<number>`(select count(*)::int from ${podPhotos} where ${podPhotos.drop_id} = ${drops.id})`,
    })
    .from(drops)
    .where(eq(drops.trip_id, id))
    .orderBy(drops.sequence);

  const checks = await db
    .select({
      id: vehicleChecks.id,
      performedAt: vehicleChecks.performed_at,
      result: vehicleChecks.overall_result,
      odometer: vehicleChecks.odometer_km,
      overrideReason: vehicleChecks.override_reason,
    })
    .from(vehicleChecks)
    .where(eq(vehicleChecks.trip_id, id));

  const checkItems = checks.length
    ? await db
        .select({
          checkId: vehicleCheckItems.check_id,
          key: vehicleCheckItems.item_key,
          result: vehicleCheckItems.result,
          value: vehicleCheckItems.value,
          notes: vehicleCheckItems.notes,
        })
        .from(vehicleCheckItems)
        .where(eq(vehicleCheckItems.check_id, checks[0]!.id))
    : [];

  const trail = await db
    .select({ points: trailSegments.points })
    .from(trailSegments)
    .where(eq(trailSegments.trip_id, id));

  const deviations = await db
    .select()
    .from(tripDeviations)
    .where(eq(tripDeviations.trip_id, id));

  const fuel = await db
    .select({
      id: fuelEntries.id,
      litres: fuelEntries.litres,
      totalCost: fuelEntries.total_cost,
      station: fuelEntries.station,
      filledAt: fuelEntries.filled_at,
    })
    .from(fuelEntries)
    .where(eq(fuelEntries.trip_id, id));

  const costs = await db
    .select({
      id: costEntries.id,
      category: costEntries.category,
      amount: costEntries.amount,
      description: costEntries.description,
      status: costEntries.status,
    })
    .from(costEntries)
    .where(eq(costEntries.trip_id, id));

  return {
    trip: {
      ...trip,
      plannedDistanceKm: trip.plannedDistanceM ? trip.plannedDistanceM / 1000 : null,
      actualDistanceKm: trip.actualDistanceM ? trip.actualDistanceM / 1000 : null,
      odometerKm: money(trip.endOdo) - money(trip.startOdo),
    },
    drops: dropRows,
    checks: checks.map((c) => ({
      ...c,
      odometer: c.odometer == null ? null : money(c.odometer),
      items: checkItems.filter((i) => i.checkId === c.id),
    })),
    trail: (trail.flatMap((t) => (Array.isArray(t.points) ? t.points : [])) as {
      lat: number;
      lng: number;
      t: number;
    }[]),
    deviations,
    fuel: fuel.map((x) => ({ ...x, litres: money(x.litres), totalCost: money(x.totalCost) })),
    costs: costs.map((x) => ({ ...x, amount: money(x.amount) })),
  };
}

export async function tripsSummary(db: DB, from: Date, to: Date) {
  const [r] = await db
    .select({
      total: sql<number>`count(*)::int`,
      completed: sql<number>`count(*) filter (where ${trips.status} = 'completed')::int`,
      flagged: sql<number>`count(*) filter (where ${trips.status} = 'flagged')::int`,
      inProgress: sql<number>`count(*) filter (where ${trips.status} in ('in_progress','pre_check'))::int`,
    })
    .from(trips)
    .where(and(gte(trips.started_at, from), lt(trips.started_at, to)));
  return {
    total: r?.total ?? 0,
    completed: r?.completed ?? 0,
    flagged: r?.flagged ?? 0,
    inProgress: r?.inProgress ?? 0,
  };
}
