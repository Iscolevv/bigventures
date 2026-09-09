/**
 * Analytics + list queries that back the dashboard. All use the Drizzle query
 * builder so everything is auto-qualified to the `bigventures` schema; each
 * returns plain numbers, not numeric strings.
 */
export * from './_util';
export * from './fleet';
export * from './trips';
export * from './finance';
export * from './alerts';
export * from './incentives';

// legacy name kept for the earlier fuel view
export { fuelByVehicle as fuelConsumptionByVehicle } from './finance';
