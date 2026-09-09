import {
  text,
  timestamp,
  numeric,
  integer,
  doublePrecision,
  boolean,
  jsonb,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import type {
  TripStatus,
  DropStatus,
  DeliveryIssueCategory,
  CheckResult,
  CheckItemResult,
  DeviationType,
  EntrySource,
} from '@bv/core/enums';
import type { TrailPoint } from '@bv/core/geo';
import { user } from './auth';
import { drivers, vehicles } from './fleet';
import { bv, pk, timestamps } from './_shared';

/**
 * A named origin+destination pattern. Trips optionally reference one so the
 * route-cost analytics view can roll up "the same run" over time; a stable
 * `route_key` (see @bv/core geo.routeKey) is also stored on the trip itself so
 * grouping works even for ad-hoc trips with no route row.
 */
export const routes = bv.table('routes', {
  id: pk(),
  name: text('name').notNull(),
  origin_label: text('origin_label').notNull(),
  origin_lat: doublePrecision('origin_lat'),
  origin_lng: doublePrecision('origin_lng'),
  notes: text('notes'),
  active: boolean('active').notNull().default(true),
  ...timestamps,
});

export const trips = bv.table(
  'trips',
  {
    id: pk(),
    reference_code: text('reference_code').notNull().unique(), // TRP-2026-000123
    vehicle_id: text('vehicle_id')
      .notNull()
      .references(() => vehicles.id, { onDelete: 'restrict' }),
    driver_id: text('driver_id')
      .notNull()
      .references(() => drivers.id, { onDelete: 'restrict' }),
    route_id: text('route_id').references(() => routes.id, { onDelete: 'set null' }),
    route_key: text('route_key'),
    status: text('status').$type<TripStatus>().notNull().default('draft'),

    loading_point_address: text('loading_point_address').notNull(),
    loading_lat: doublePrecision('loading_lat'),
    loading_lng: doublePrecision('loading_lng'),

    planned_distance_m: integer('planned_distance_m'),
    planned_duration_s: integer('planned_duration_s'),
    planned_polyline: text('planned_polyline'), // encoded polyline from directions API

    started_at: timestamp('started_at'),
    ended_at: timestamp('ended_at'),
    start_odometer_km: numeric('start_odometer_km', { precision: 12, scale: 1 }),
    end_odometer_km: numeric('end_odometer_km', { precision: 12, scale: 1 }),
    actual_distance_m: integer('actual_distance_m'), // from trail

    cargo_description: text('cargo_description'),
    // Soft FK to clients — kept as text to avoid a trips↔finance import cycle;
    // the relation is declared in relations.ts. App-enforced.
    client_id: text('client_id'),
    client_ref: text('client_ref'),
    notes: text('notes'),

    source: text('source').$type<EntrySource>().notNull().default('mobile'),
    device_id: text('device_id'),
    // the app's local id — plain unique (nullable → multiple NULLs allowed),
    // so ON CONFLICT (client_uuid) works for idempotent sync upserts.
    client_uuid: text('client_uuid').unique(),
    created_by: text('created_by').references(() => user.id, { onDelete: 'set null' }),
    synced_at: timestamp('synced_at'),
    ...timestamps,
  },
  (t) => [
    index('trips_vehicle_idx').on(t.vehicle_id),
    index('trips_driver_idx').on(t.driver_id),
    index('trips_status_idx').on(t.status),
    index('trips_started_at_idx').on(t.started_at),
    index('trips_route_key_idx').on(t.route_key),
  ],
);

export const drops = bv.table(
  'drops',
  {
    id: pk(),
    trip_id: text('trip_id')
      .notNull()
      .references(() => trips.id, { onDelete: 'cascade' }),
    sequence: integer('sequence').notNull(),
    destination_address: text('destination_address').notNull(),
    dest_lat: doublePrecision('dest_lat'),
    dest_lng: doublePrecision('dest_lng'),
    geofence_radius_m: integer('geofence_radius_m').notNull().default(120),

    status: text('status').$type<DropStatus>().notNull().default('pending'),
    signee_name: text('signee_name'),
    issue_category: text('issue_category').$type<DeliveryIssueCategory>(),
    issue_notes: text('issue_notes'),
    notes: text('notes'),

    arrived_at: timestamp('arrived_at'),
    completed_at: timestamp('completed_at'),
    geofence_entered_at: timestamp('geofence_entered_at'),
    /** true when the driver set a terminal status without the geofence ever firing */
    geofence_skipped: boolean('geofence_skipped').notNull().default(false),

    client_uuid: text('client_uuid').unique(),
    ...timestamps,
  },
  (t) => [
    index('drops_trip_idx').on(t.trip_id),
    index('drops_status_idx').on(t.status),
    uniqueIndex('drops_trip_sequence_key').on(t.trip_id, t.sequence),
  ],
);

/** Proof-of-delivery photos. Files live in R2; this row is the metadata + audit. */
export const podPhotos = bv.table(
  'pod_photos',
  {
    id: pk(),
    drop_id: text('drop_id')
      .notNull()
      .references(() => drops.id, { onDelete: 'cascade' }),
    storage_key: text('storage_key').notNull(), // R2 object key
    thumbnail_key: text('thumbnail_key'),
    captured_lat: doublePrecision('captured_lat'),
    captured_lng: doublePrecision('captured_lng'),
    captured_at: timestamp('captured_at').notNull(),
    device_timestamp: timestamp('device_timestamp'),
    sha256: text('sha256'),
    file_size: integer('file_size'),
    mime_type: text('mime_type'),
    /** always 'camera' — gallery uploads are rejected client-side */
    source: text('source').notNull().default('camera'),
    uploaded_at: timestamp('uploaded_at').notNull().defaultNow(),
    client_uuid: text('client_uuid').unique(),
  },
  (t) => [index('pod_photos_drop_idx').on(t.drop_id)],
);

export const vehicleChecks = bv.table(
  'vehicle_checks',
  {
    id: pk(),
    trip_id: text('trip_id').references(() => trips.id, { onDelete: 'cascade' }),
    vehicle_id: text('vehicle_id')
      .notNull()
      .references(() => vehicles.id, { onDelete: 'restrict' }),
    driver_id: text('driver_id')
      .notNull()
      .references(() => drivers.id, { onDelete: 'restrict' }),
    performed_at: timestamp('performed_at').notNull(),
    overall_result: text('overall_result').$type<CheckResult>().notNull(),
    odometer_km: numeric('odometer_km', { precision: 12, scale: 1 }),
    /** ops override when a blocking item failed but the trip was allowed anyway */
    overridden_by: text('overridden_by').references(() => user.id, { onDelete: 'set null' }),
    override_reason: text('override_reason'),
    notes: text('notes'),
    client_uuid: text('client_uuid').unique(),
    ...timestamps,
  },
  (t) => [
    index('vehicle_checks_trip_idx').on(t.trip_id),
    index('vehicle_checks_vehicle_idx').on(t.vehicle_id),
  ],
);

export const vehicleCheckItems = bv.table(
  'vehicle_check_items',
  {
    id: pk(),
    check_id: text('check_id')
      .notNull()
      .references(() => vehicleChecks.id, { onDelete: 'cascade' }),
    item_key: text('item_key').notNull(), // matches VEHICLE_CHECK_TEMPLATE keys
    result: text('result').$type<CheckItemResult>().notNull(),
    value: text('value'), // e.g. fuel level "3/4"
    photo_key: text('photo_key'),
    notes: text('notes'),
  },
  (t) => [
    index('vehicle_check_items_check_idx').on(t.check_id),
    uniqueIndex('vehicle_check_items_check_key').on(t.check_id, t.item_key),
  ],
);

/**
 * GPS trail, stored in batches rather than one row per fix. The mobile app
 * flushes a segment every N points / minutes; keeps write volume sane.
 */
export const trailSegments = bv.table(
  'trail_segments',
  {
    id: pk(),
    trip_id: text('trip_id')
      .notNull()
      .references(() => trips.id, { onDelete: 'cascade' }),
    points: jsonb('points').$type<TrailPoint[]>().notNull().default([]),
    point_count: integer('point_count').notNull().default(0),
    started_at: timestamp('started_at'),
    ended_at: timestamp('ended_at'),
    client_uuid: text('client_uuid').unique(),
    created_at: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => [index('trail_segments_trip_idx').on(t.trip_id)],
);

export const tripDeviations = bv.table(
  'trip_deviations',
  {
    id: pk(),
    trip_id: text('trip_id')
      .notNull()
      .references(() => trips.id, { onDelete: 'cascade' }),
    type: text('type').$type<DeviationType>().notNull(),
    detected_at: timestamp('detected_at').notNull(),
    lat: doublePrecision('lat'),
    lng: doublePrecision('lng'),
    detail: jsonb('detail'),
    reviewed: boolean('reviewed').notNull().default(false),
    reviewed_by: text('reviewed_by').references(() => user.id, { onDelete: 'set null' }),
    review_notes: text('review_notes'),
    created_at: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => [
    index('trip_deviations_trip_idx').on(t.trip_id),
    index('trip_deviations_reviewed_idx').on(t.reviewed),
  ],
);
