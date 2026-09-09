import { sql, eq, and, desc, isNull } from 'drizzle-orm';
import type { DB } from '../index';
import {
  vehicles,
  drivers,
  user,
  vehicleAssignments,
  trips,
  qualitySnapshots,
} from '../schema';
import { money } from './_util';

export interface DriverRow {
  id: string;
  userId: string;
  name: string;
  phone: string;
  email: string | null;
  status: string;
  licenseNumber: string | null;
  licenseExpiry: string | null;
  baseSalary: number;
  advanceBalance: number;
  lossBalance: number;
  assignedVehicle: string | null;
  tripsLast30: number;
  qualityScore: number | null;
}

export async function driverRoster(db: DB): Promise<DriverRow[]> {
  const rows = await db
    .select({
      id: drivers.id,
      userId: drivers.user_id,
      name: drivers.full_name,
      phone: drivers.phone,
      email: user.email,
      status: drivers.status,
      licenseNumber: drivers.license_number,
      licenseExpiry: drivers.license_expiry,
      baseSalary: drivers.base_salary,
      advanceBalance: drivers.advance_balance,
      lossBalance: drivers.loss_balance,
      assignedVehicle: vehicles.registration,
      tripsLast30: sql<number>`(
        select count(*)::int from ${trips}
        where ${trips.driver_id} = ${drivers.id}
          and ${trips.started_at} >= now() - interval '30 days'
      )`,
      qualityScore: sql<string | null>`(
        select ${qualitySnapshots.composite_score} from ${qualitySnapshots}
        where ${qualitySnapshots.driver_id} = ${drivers.id}
        order by ${qualitySnapshots.period_key} desc limit 1
      )`,
    })
    .from(drivers)
    .leftJoin(user, eq(user.id, drivers.user_id))
    .leftJoin(
      vehicleAssignments,
      and(eq(vehicleAssignments.driver_id, drivers.id), isNull(vehicleAssignments.end_date)),
    )
    .leftJoin(vehicles, eq(vehicles.id, vehicleAssignments.vehicle_id))
    .orderBy(drivers.full_name);

  return rows.map((r) => ({
    ...r,
    baseSalary: money(r.baseSalary),
    advanceBalance: money(r.advanceBalance),
    lossBalance: money(r.lossBalance),
    qualityScore: r.qualityScore == null ? null : money(r.qualityScore),
  }));
}

export interface VehicleRow {
  id: string;
  registration: string;
  type: string;
  status: string;
  makeModel: string | null;
  odometerKm: number;
  monthlyFinanceCost: number;
  nextServiceDueKm: number | null;
  nextServiceDueDate: string | null;
  driver: string | null;
  tripsLast30: number;
  lastTripAt: Date | null;
}

export async function vehicleFleet(db: DB): Promise<VehicleRow[]> {
  const rows = await db
    .select({
      id: vehicles.id,
      registration: vehicles.registration,
      type: vehicles.vehicle_type,
      status: vehicles.status,
      make: vehicles.make,
      model: vehicles.model,
      odometerKm: vehicles.odometer_km,
      monthlyFinanceCost: vehicles.monthly_finance_cost,
      nextServiceDueKm: vehicles.next_service_due_km,
      nextServiceDueDate: vehicles.next_service_due_date,
      driver: drivers.full_name,
      tripsLast30: sql<number>`(
        select count(*)::int from ${trips}
        where ${trips.vehicle_id} = ${vehicles.id}
          and ${trips.started_at} >= now() - interval '30 days'
      )`,
      lastTripAt: sql<Date | null>`(
        select max(${trips.started_at}) from ${trips} where ${trips.vehicle_id} = ${vehicles.id}
      )`,
    })
    .from(vehicles)
    .leftJoin(
      vehicleAssignments,
      and(eq(vehicleAssignments.vehicle_id, vehicles.id), isNull(vehicleAssignments.end_date)),
    )
    .leftJoin(drivers, eq(drivers.id, vehicleAssignments.driver_id))
    .orderBy(desc(vehicles.status), vehicles.registration);

  return rows.map((r) => ({
    id: r.id,
    registration: r.registration,
    type: r.type,
    status: r.status,
    makeModel: [r.make, r.model].filter(Boolean).join(' ') || null,
    odometerKm: money(r.odometerKm),
    monthlyFinanceCost: money(r.monthlyFinanceCost),
    nextServiceDueKm: r.nextServiceDueKm == null ? null : money(r.nextServiceDueKm),
    nextServiceDueDate: r.nextServiceDueDate,
    driver: r.driver,
    tripsLast30: r.tripsLast30,
    lastTripAt: r.lastTripAt,
  }));
}

export async function fleetSummary(db: DB) {
  const [v] = await db
    .select({
      total: sql<number>`count(*)::int`,
      active: sql<number>`count(*) filter (where ${vehicles.status} = 'active')::int`,
      inRepair: sql<number>`count(*) filter (where ${vehicles.status} in ('in_repair','grounded'))::int`,
    })
    .from(vehicles);
  const [d] = await db
    .select({
      total: sql<number>`count(*)::int`,
      active: sql<number>`count(*) filter (where ${drivers.status} = 'active')::int`,
    })
    .from(drivers);
  return {
    vehicles: v?.total ?? 0,
    vehiclesActive: v?.active ?? 0,
    vehiclesInRepair: v?.inRepair ?? 0,
    drivers: d?.total ?? 0,
    driversActive: d?.active ?? 0,
  };
}
