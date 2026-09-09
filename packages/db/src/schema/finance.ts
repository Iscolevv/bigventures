import {
  text,
  timestamp,
  numeric,
  integer,
  boolean,
  jsonb,
  date,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import type {
  CostCategory,
  CostStatus,
  EntrySource,
  AdvanceDirection,
  PaymentMethod,
  PayrollStatus,
  RateType,
  InvoiceStatus,
} from '@bv/core/enums';
import { user } from './auth';
import { drivers, vehicles } from './fleet';
import { trips, drops } from './trips';
import { bv, pk, timestamps } from './_shared';

// --- Clients & rates --------------------------------------------------

export const clients = bv.table('clients', {
  id: pk(),
  name: text('name').notNull(),
  contact_name: text('contact_name'),
  phone: text('phone'),
  email: text('email'),
  address: text('address'),
  payment_terms_days: integer('payment_terms_days').notNull().default(30),
  active: boolean('active').notNull().default(true),
  notes: text('notes'),
  ...timestamps,
});

export const clientRates = bv.table(
  'client_rates',
  {
    id: pk(),
    client_id: text('client_id')
      .notNull()
      .references(() => clients.id, { onDelete: 'cascade' }),
    route_id: text('route_id'),
    vehicle_type: text('vehicle_type'),
    rate_type: text('rate_type').$type<RateType>().notNull(),
    amount: numeric('amount', { precision: 14, scale: 2 }).notNull(),
    effective_from: date('effective_from').notNull(),
    effective_to: date('effective_to'),
    notes: text('notes'),
    ...timestamps,
  },
  (t) => [index('client_rates_client_idx').on(t.client_id)],
);

// --- Fuel -----------------------------------------------------------

export const fuelEntries = bv.table(
  'fuel_entries',
  {
    id: pk(),
    vehicle_id: text('vehicle_id')
      .notNull()
      .references(() => vehicles.id, { onDelete: 'restrict' }),
    driver_id: text('driver_id').references(() => drivers.id, { onDelete: 'set null' }),
    trip_id: text('trip_id').references(() => trips.id, { onDelete: 'set null' }),
    litres: numeric('litres', { precision: 10, scale: 2 }).notNull(),
    unit_price: numeric('unit_price', { precision: 10, scale: 2 }),
    total_cost: numeric('total_cost', { precision: 14, scale: 2 }).notNull(),
    odometer_km: numeric('odometer_km', { precision: 12, scale: 1 }).notNull(),
    station: text('station'),
    receipt_photo_key: text('receipt_photo_key'),
    filled_at: timestamp('filled_at').notNull(),
    device_timestamp: timestamp('device_timestamp'),
    source: text('source').$type<EntrySource>().notNull().default('mobile'),
    created_by: text('created_by').references(() => user.id, { onDelete: 'set null' }),
    client_uuid: text('client_uuid').unique(),
    notes: text('notes'),
    ...timestamps,
  },
  (t) => [
    index('fuel_entries_vehicle_idx').on(t.vehicle_id),
    index('fuel_entries_filled_at_idx').on(t.filled_at),
    index('fuel_entries_trip_idx').on(t.trip_id),
  ],
);

// --- Costs (repairs, service, parking, police, fines...) ------------

export const costEntries = bv.table(
  'cost_entries',
  {
    id: pk(),
    vehicle_id: text('vehicle_id').references(() => vehicles.id, { onDelete: 'set null' }),
    driver_id: text('driver_id').references(() => drivers.id, { onDelete: 'set null' }),
    trip_id: text('trip_id').references(() => trips.id, { onDelete: 'set null' }),
    category: text('category').$type<CostCategory>().notNull(),
    amount: numeric('amount', { precision: 14, scale: 2 }).notNull(),
    incurred_at: date('incurred_at').notNull(),
    description: text('description'),
    vendor: text('vendor'),
    receipt_photo_key: text('receipt_photo_key'),
    status: text('status').$type<CostStatus>().notNull().default('pending'),
    approved_by: text('approved_by').references(() => user.id, { onDelete: 'set null' }),
    approved_at: timestamp('approved_at'),
    source: text('source').$type<EntrySource>().notNull().default('dashboard'),
    created_by: text('created_by').references(() => user.id, { onDelete: 'set null' }),
    ...timestamps,
  },
  (t) => [
    index('cost_entries_vehicle_idx').on(t.vehicle_id),
    index('cost_entries_driver_idx').on(t.driver_id),
    index('cost_entries_category_idx').on(t.category),
    index('cost_entries_incurred_at_idx').on(t.incurred_at),
  ],
);

// --- Advances ledger ----------------------------------------------

export const advances = bv.table(
  'advances',
  {
    id: pk(),
    driver_id: text('driver_id')
      .notNull()
      .references(() => drivers.id, { onDelete: 'cascade' }),
    amount: numeric('amount', { precision: 14, scale: 2 }).notNull(),
    direction: text('direction').$type<AdvanceDirection>().notNull(),
    issued_at: date('issued_at').notNull(),
    method: text('method').$type<PaymentMethod>(),
    reference: text('reference'),
    description: text('description'),
    trip_id: text('trip_id').references(() => trips.id, { onDelete: 'set null' }),
    /** set when this row was auto-created by a payroll run's deduction */
    payroll_run_id: text('payroll_run_id'),
    created_by: text('created_by').references(() => user.id, { onDelete: 'set null' }),
    ...timestamps,
  },
  (t) => [
    index('advances_driver_idx').on(t.driver_id),
    index('advances_issued_at_idx').on(t.issued_at),
  ],
);

// --- Incentive rules (editable by ops/management) -----------------

export const incentiveRules = bv.table('incentive_rules', {
  id: pk(),
  name: text('name').notNull(),
  active: boolean('active').notNull().default(true),
  effective_from: date('effective_from').notNull(),
  effective_to: date('effective_to'),
  /** validated by @bv/core incentiveRuleConfigSchema */
  config: jsonb('config').notNull(),
  created_by: text('created_by').references(() => user.id, { onDelete: 'set null' }),
  ...timestamps,
});

// --- Quality snapshots (per driver per period) -------------------

export const qualitySnapshots = bv.table(
  'quality_snapshots',
  {
    id: pk(),
    driver_id: text('driver_id')
      .notNull()
      .references(() => drivers.id, { onDelete: 'cascade' }),
    period_key: text('period_key').notNull(), // "YYYY-MM"
    on_time_pct: numeric('on_time_pct', { precision: 5, scale: 4 }),
    damage_free_pct: numeric('damage_free_pct', { precision: 5, scale: 4 }),
    check_compliance_pct: numeric('check_compliance_pct', { precision: 5, scale: 4 }),
    pod_compliance_pct: numeric('pod_compliance_pct', { precision: 5, scale: 4 }),
    at_fault_incidents: integer('at_fault_incidents').notNull().default(0),
    composite_score: numeric('composite_score', { precision: 5, scale: 4 }).notNull(),
    computed_at: timestamp('computed_at').notNull().defaultNow(),
  },
  (t) => [uniqueIndex('quality_snapshots_driver_period_key').on(t.driver_id, t.period_key)],
);

// --- Payroll runs ------------------------------------------------

export const payrollRuns = bv.table(
  'payroll_runs',
  {
    id: pk(),
    driver_id: text('driver_id')
      .notNull()
      .references(() => drivers.id, { onDelete: 'restrict' }),
    period_key: text('period_key').notNull(),
    period_start: date('period_start').notNull(),
    period_end: date('period_end').notNull(),
    trip_count: integer('trip_count').notNull().default(0),
    base_salary: numeric('base_salary', { precision: 14, scale: 2 }).notNull(),
    incentive_amount: numeric('incentive_amount', { precision: 14, scale: 2 }).notNull().default('0'),
    incentive_rule_id: text('incentive_rule_id').references(() => incentiveRules.id, {
      onDelete: 'set null',
    }),
    quality_score: numeric('quality_score', { precision: 5, scale: 4 }),
    advance_deduction: numeric('advance_deduction', { precision: 14, scale: 2 }).notNull().default('0'),
    loss_deduction: numeric('loss_deduction', { precision: 14, scale: 2 }).notNull().default('0'),
    net_pay: numeric('net_pay', { precision: 14, scale: 2 }).notNull(),
    /** full evaluateIncentive + runPayroll output, for audit / payslip */
    breakdown: jsonb('breakdown'),
    status: text('status').$type<PayrollStatus>().notNull().default('draft'),
    approved_by: text('approved_by').references(() => user.id, { onDelete: 'set null' }),
    approved_at: timestamp('approved_at'),
    paid_at: timestamp('paid_at'),
    ...timestamps,
  },
  (t) => [uniqueIndex('payroll_runs_driver_period_key').on(t.driver_id, t.period_key)],
);

// --- Invoicing --------------------------------------------------

export const invoices = bv.table(
  'invoices',
  {
    id: pk(),
    invoice_number: text('invoice_number').notNull().unique(),
    client_id: text('client_id')
      .notNull()
      .references(() => clients.id, { onDelete: 'restrict' }),
    status: text('status').$type<InvoiceStatus>().notNull().default('draft'),
    issue_date: date('issue_date'),
    due_date: date('due_date'),
    subtotal: numeric('subtotal', { precision: 14, scale: 2 }).notNull().default('0'),
    tax: numeric('tax', { precision: 14, scale: 2 }).notNull().default('0'),
    total: numeric('total', { precision: 14, scale: 2 }).notNull().default('0'),
    amount_paid: numeric('amount_paid', { precision: 14, scale: 2 }).notNull().default('0'),
    /** true if any linked trip has an unresolved damage/return issue */
    has_unresolved_issues: boolean('has_unresolved_issues').notNull().default(false),
    notes: text('notes'),
    created_by: text('created_by').references(() => user.id, { onDelete: 'set null' }),
    ...timestamps,
  },
  (t) => [
    index('invoices_client_idx').on(t.client_id),
    index('invoices_status_idx').on(t.status),
    index('invoices_due_date_idx').on(t.due_date),
  ],
);

export const invoiceLines = bv.table(
  'invoice_lines',
  {
    id: pk(),
    invoice_id: text('invoice_id')
      .notNull()
      .references(() => invoices.id, { onDelete: 'cascade' }),
    trip_id: text('trip_id').references(() => trips.id, { onDelete: 'set null' }),
    drop_id: text('drop_id').references(() => drops.id, { onDelete: 'set null' }),
    description: text('description').notNull(),
    quantity: numeric('quantity', { precision: 10, scale: 2 }).notNull().default('1'),
    unit_amount: numeric('unit_amount', { precision: 14, scale: 2 }).notNull(),
    line_total: numeric('line_total', { precision: 14, scale: 2 }).notNull(),
  },
  (t) => [
    index('invoice_lines_invoice_idx').on(t.invoice_id),
    index('invoice_lines_trip_idx').on(t.trip_id),
  ],
);

export const payments = bv.table(
  'payments',
  {
    id: pk(),
    invoice_id: text('invoice_id')
      .notNull()
      .references(() => invoices.id, { onDelete: 'cascade' }),
    amount: numeric('amount', { precision: 14, scale: 2 }).notNull(),
    paid_at: date('paid_at').notNull(),
    method: text('method').$type<PaymentMethod>(),
    reference: text('reference'),
    recorded_by: text('recorded_by').references(() => user.id, { onDelete: 'set null' }),
    created_at: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => [index('payments_invoice_idx').on(t.invoice_id)],
);
