import { sql } from 'drizzle-orm';
import { text, timestamp, numeric, integer, date, index, uniqueIndex } from 'drizzle-orm/pg-core';
import type { DriverStatus, VehicleType, VehicleStatus } from '@bv/core/enums';
import { user } from './auth';
import { bv, pk, timestamps } from './_shared';

/**
 * Driver = profile extension of a `user` whose role is `driver`. Drivers sign
 * in to the mobile app with their user account; this table holds the HR /
 * compliance / payroll fields the dashboard needs.
 */
export const drivers = bv.table(
  'drivers',
  {
    id: pk(),
    user_id: text('user_id')
      .notNull()
      .unique()
      .references(() => user.id, { onDelete: 'restrict' }),
    full_name: text('full_name').notNull(),
    phone: text('phone').notNull(),
    national_id: text('national_id'),
    license_number: text('license_number'),
    license_expiry: date('license_expiry'),
    date_joined: date('date_joined'),
    base_salary: numeric('base_salary', { precision: 14, scale: 2 }).notNull().default('0'),
    /** cached net advance owed; source of truth is the advances ledger */
    advance_balance: numeric('advance_balance', { precision: 14, scale: 2 }).notNull().default('0'),
    /** cached net at-fault loss still to recover */
    loss_balance: numeric('loss_balance', { precision: 14, scale: 2 }).notNull().default('0'),
    status: text('status').$type<DriverStatus>().notNull().default('active'),
    emergency_contact_name: text('emergency_contact_name'),
    emergency_contact_phone: text('emergency_contact_phone'),
    notes: text('notes'),
    ...timestamps,
  },
  (t) => [index('drivers_status_idx').on(t.status)],
);

export const vehicles = bv.table(
  'vehicles',
  {
    id: pk(),
    registration: text('registration').notNull().unique(),
    make: text('make'),
    model: text('model'),
    year: integer('year'),
    vehicle_type: text('vehicle_type').$type<VehicleType>().notNull(),
    status: text('status').$type<VehicleStatus>().notNull().default('active'),
    /** cached latest odometer (km); updated by fuel entries + trip close */
    odometer_km: numeric('odometer_km', { precision: 12, scale: 1 }).notNull().default('0'),
    acquisition_date: date('acquisition_date'),
    acquisition_cost: numeric('acquisition_cost', { precision: 14, scale: 2 }),
    /**
     * Monthly finance / SACCO contribution for this vehicle (the "TRUCKS
     * CONTRIBUTION" / "VAN CONTRIBUTION" lines). Used as allocated overhead in
     * the ROI dashboard.
     */
    monthly_finance_cost: numeric('monthly_finance_cost', { precision: 14, scale: 2 })
      .notNull()
      .default('0'),
    /** last service snapshot for the maintenance_due alert */
    last_service_odometer_km: numeric('last_service_odometer_km', { precision: 12, scale: 1 }),
    next_service_due_km: numeric('next_service_due_km', { precision: 12, scale: 1 }),
    next_service_due_date: date('next_service_due_date'),
    notes: text('notes'),
    ...timestamps,
  },
  (t) => [index('vehicles_status_idx').on(t.status)],
);

/** History of which driver was assigned which vehicle. `end_date` null = current. */
export const vehicleAssignments = bv.table(
  'vehicle_assignments',
  {
    id: pk(),
    vehicle_id: text('vehicle_id')
      .notNull()
      .references(() => vehicles.id, { onDelete: 'cascade' }),
    driver_id: text('driver_id')
      .notNull()
      .references(() => drivers.id, { onDelete: 'cascade' }),
    start_date: date('start_date').notNull(),
    end_date: date('end_date'),
    assigned_by: text('assigned_by').references(() => user.id, { onDelete: 'set null' }),
    notes: text('notes'),
    created_at: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => [
    index('vehicle_assignments_vehicle_idx').on(t.vehicle_id),
    index('vehicle_assignments_driver_idx').on(t.driver_id),
    // at most one open assignment per vehicle
    uniqueIndex('vehicle_assignments_open_per_vehicle')
      .on(t.vehicle_id)
      .where(sql`${t.end_date} is null`),
  ],
);
