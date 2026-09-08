import { sql } from 'drizzle-orm';
import {
  pgTable,
  text,
  timestamp,
  jsonb,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import type {
  AlertType,
  AlertSeverity,
  AlertStatus,
  AuditAction,
  SyncBatchStatus,
  Role,
} from '@bv/core/enums';
import { user } from './auth';
import { drivers } from './fleet';
import { pk } from './_shared';

/** Registered driver devices — for push notifications and sync attribution. */
export const devices = pgTable(
  'devices',
  {
    id: pk(),
    device_id: text('device_id').notNull().unique(), // stable client-generated id
    driver_id: text('driver_id').references(() => drivers.id, { onDelete: 'set null' }),
    platform: text('platform'), // android | ios
    model: text('model'),
    app_version: text('app_version'),
    push_token: text('push_token'),
    last_seen_at: timestamp('last_seen_at'),
    registered_at: timestamp('registered_at').notNull().defaultNow(),
  },
  (t) => [index('devices_driver_idx').on(t.driver_id)],
);

/** One row per mobile sync POST — idempotency + a record of what came in. */
export const syncBatches = pgTable(
  'sync_batches',
  {
    id: pk(),
    batch_id: text('batch_id').notNull().unique(), // client-generated idempotency key
    device_id: text('device_id').notNull(),
    driver_id: text('driver_id').references(() => drivers.id, { onDelete: 'set null' }),
    app_version: text('app_version'),
    received_at: timestamp('received_at').notNull().defaultNow(),
    status: text('status').$type<SyncBatchStatus>().notNull(),
    summary: jsonb('summary'), // counts per entity
    conflicts: jsonb('conflicts'),
    rejected: jsonb('rejected'),
  },
  (t) => [index('sync_batches_device_idx').on(t.device_id)],
);

/** Exception / alerts panel feed. Raised by background jobs and inline events. */
export const alerts = pgTable(
  'alerts',
  {
    id: pk(),
    type: text('type').$type<AlertType>().notNull(),
    severity: text('severity').$type<AlertSeverity>().notNull(),
    status: text('status').$type<AlertStatus>().notNull().default('open'),
    entity_type: text('entity_type'), // 'trip' | 'vehicle' | 'driver' | 'invoice' | 'document'
    entity_id: text('entity_id'),
    title: text('title').notNull(),
    detail: jsonb('detail'),
    /**
     * Stable key so the same underlying condition doesn't create duplicate
     * open alerts (e.g. `document_expiry:<docId>`). Partial-unique on open rows.
     */
    dedupe_key: text('dedupe_key'),
    raised_at: timestamp('raised_at').notNull().defaultNow(),
    acknowledged_by: text('acknowledged_by').references(() => user.id, { onDelete: 'set null' }),
    acknowledged_at: timestamp('acknowledged_at'),
    resolved_by: text('resolved_by').references(() => user.id, { onDelete: 'set null' }),
    resolved_at: timestamp('resolved_at'),
    resolution_notes: text('resolution_notes'),
  },
  (t) => [
    index('alerts_status_idx').on(t.status),
    index('alerts_type_idx').on(t.type),
    index('alerts_entity_idx').on(t.entity_type, t.entity_id),
    uniqueIndex('alerts_open_dedupe_key')
      .on(t.dedupe_key)
      .where(sql`${t.dedupe_key} is not null and ${t.status} in ('open','acknowledged')`),
  ],
);

/** Append-only audit trail. Every mutation to a tracked entity writes one row. */
export const auditLog = pgTable(
  'audit_log',
  {
    id: pk(),
    actor_id: text('actor_id').references(() => user.id, { onDelete: 'set null' }),
    actor_role: text('actor_role').$type<Role>(),
    action: text('action').$type<AuditAction>().notNull(),
    entity_type: text('entity_type').notNull(),
    entity_id: text('entity_id').notNull(),
    before: jsonb('before'),
    after: jsonb('after'),
    source: text('source'), // 'dashboard' | 'mobile' | 'system'
    ip: text('ip'),
    user_agent: text('user_agent'),
    at: timestamp('at').notNull().defaultNow(),
  },
  (t) => [
    index('audit_log_entity_idx').on(t.entity_type, t.entity_id),
    index('audit_log_actor_idx').on(t.actor_id),
    index('audit_log_at_idx').on(t.at),
  ],
);

/** App-wide settings (single row, keyed 'default'). Company doc fields, tax %, etc. */
export const settings = pgTable('settings', {
  key: text('key').primaryKey().default('default'),
  company_name: text('company_name').notNull().default('Big Ventures'),
  company_kra_pin: text('company_kra_pin'),
  invoice_tax_pct: text('invoice_tax_pct').notNull().default('0'),
  invoice_prefix: text('invoice_prefix').notNull().default('BV'),
  trip_prefix: text('trip_prefix').notNull().default('TRP'),
  active_incentive_rule_id: text('active_incentive_rule_id'),
  updated_by: text('updated_by').references(() => user.id, { onDelete: 'set null' }),
  updated_at: timestamp('updated_at').notNull().defaultNow(),
  extra: jsonb('extra'),
});
