import { relations } from 'drizzle-orm';
import { user } from './auth';
import { drivers, vehicles, vehicleAssignments } from './fleet';
import {
  routes,
  trips,
  drops,
  podPhotos,
  vehicleChecks,
  vehicleCheckItems,
  trailSegments,
  tripDeviations,
} from './trips';
import {
  clients,
  clientRates,
  fuelEntries,
  costEntries,
  advances,
  incentiveRules,
  qualitySnapshots,
  payrollRuns,
  invoices,
  invoiceLines,
  payments,
} from './finance';

export const userRelations = relations(user, ({ one }) => ({
  driver: one(drivers, { fields: [user.id], references: [drivers.user_id] }),
}));

export const driverRelations = relations(drivers, ({ one, many }) => ({
  user: one(user, { fields: [drivers.user_id], references: [user.id] }),
  assignments: many(vehicleAssignments),
  trips: many(trips),
  advances: many(advances),
  qualitySnapshots: many(qualitySnapshots),
  payrollRuns: many(payrollRuns),
}));

export const vehicleRelations = relations(vehicles, ({ many }) => ({
  assignments: many(vehicleAssignments),
  trips: many(trips),
  fuelEntries: many(fuelEntries),
  costEntries: many(costEntries),
}));

export const vehicleAssignmentRelations = relations(vehicleAssignments, ({ one }) => ({
  vehicle: one(vehicles, { fields: [vehicleAssignments.vehicle_id], references: [vehicles.id] }),
  driver: one(drivers, { fields: [vehicleAssignments.driver_id], references: [drivers.id] }),
}));

export const routeRelations = relations(routes, ({ many }) => ({
  trips: many(trips),
}));

export const tripRelations = relations(trips, ({ one, many }) => ({
  vehicle: one(vehicles, { fields: [trips.vehicle_id], references: [vehicles.id] }),
  driver: one(drivers, { fields: [trips.driver_id], references: [drivers.id] }),
  route: one(routes, { fields: [trips.route_id], references: [routes.id] }),
  client: one(clients, { fields: [trips.client_id], references: [clients.id] }),
  drops: many(drops),
  checks: many(vehicleChecks),
  trail: many(trailSegments),
  deviations: many(tripDeviations),
  fuelEntries: many(fuelEntries),
  costEntries: many(costEntries),
}));

export const dropRelations = relations(drops, ({ one, many }) => ({
  trip: one(trips, { fields: [drops.trip_id], references: [trips.id] }),
  photos: many(podPhotos),
}));

export const podPhotoRelations = relations(podPhotos, ({ one }) => ({
  drop: one(drops, { fields: [podPhotos.drop_id], references: [drops.id] }),
}));

export const vehicleCheckRelations = relations(vehicleChecks, ({ one, many }) => ({
  trip: one(trips, { fields: [vehicleChecks.trip_id], references: [trips.id] }),
  vehicle: one(vehicles, { fields: [vehicleChecks.vehicle_id], references: [vehicles.id] }),
  driver: one(drivers, { fields: [vehicleChecks.driver_id], references: [drivers.id] }),
  items: many(vehicleCheckItems),
}));

export const vehicleCheckItemRelations = relations(vehicleCheckItems, ({ one }) => ({
  check: one(vehicleChecks, {
    fields: [vehicleCheckItems.check_id],
    references: [vehicleChecks.id],
  }),
}));

export const trailSegmentRelations = relations(trailSegments, ({ one }) => ({
  trip: one(trips, { fields: [trailSegments.trip_id], references: [trips.id] }),
}));

export const tripDeviationRelations = relations(tripDeviations, ({ one }) => ({
  trip: one(trips, { fields: [tripDeviations.trip_id], references: [trips.id] }),
}));

export const clientRelations = relations(clients, ({ many }) => ({
  rates: many(clientRates),
  trips: many(trips),
  invoices: many(invoices),
}));

export const clientRateRelations = relations(clientRates, ({ one }) => ({
  client: one(clients, { fields: [clientRates.client_id], references: [clients.id] }),
}));

export const fuelEntryRelations = relations(fuelEntries, ({ one }) => ({
  vehicle: one(vehicles, { fields: [fuelEntries.vehicle_id], references: [vehicles.id] }),
  driver: one(drivers, { fields: [fuelEntries.driver_id], references: [drivers.id] }),
  trip: one(trips, { fields: [fuelEntries.trip_id], references: [trips.id] }),
}));

export const costEntryRelations = relations(costEntries, ({ one }) => ({
  vehicle: one(vehicles, { fields: [costEntries.vehicle_id], references: [vehicles.id] }),
  driver: one(drivers, { fields: [costEntries.driver_id], references: [drivers.id] }),
  trip: one(trips, { fields: [costEntries.trip_id], references: [trips.id] }),
}));

export const advanceRelations = relations(advances, ({ one }) => ({
  driver: one(drivers, { fields: [advances.driver_id], references: [drivers.id] }),
}));

export const incentiveRuleRelations = relations(incentiveRules, ({ many }) => ({
  payrollRuns: many(payrollRuns),
}));

export const payrollRunRelations = relations(payrollRuns, ({ one }) => ({
  driver: one(drivers, { fields: [payrollRuns.driver_id], references: [drivers.id] }),
  incentiveRule: one(incentiveRules, {
    fields: [payrollRuns.incentive_rule_id],
    references: [incentiveRules.id],
  }),
}));

export const invoiceRelations = relations(invoices, ({ one, many }) => ({
  client: one(clients, { fields: [invoices.client_id], references: [clients.id] }),
  lines: many(invoiceLines),
  payments: many(payments),
}));

export const invoiceLineRelations = relations(invoiceLines, ({ one }) => ({
  invoice: one(invoices, { fields: [invoiceLines.invoice_id], references: [invoices.id] }),
  trip: one(trips, { fields: [invoiceLines.trip_id], references: [trips.id] }),
  drop: one(drops, { fields: [invoiceLines.drop_id], references: [drops.id] }),
}));

export const paymentRelations = relations(payments, ({ one }) => ({
  invoice: one(invoices, { fields: [payments.invoice_id], references: [invoices.id] }),
}));
