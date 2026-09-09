import { sql } from 'drizzle-orm';
import { pgSchema, text, timestamp } from 'drizzle-orm/pg-core';

/**
 * All Big Ventures tables live in a dedicated Postgres schema so this database
 * can be shared with other apps (Moody Treats) without table-name collisions.
 * Both use Better Auth, so both would otherwise want `public.user` etc.
 */
export const bv = pgSchema('bigventures');

/** text PK defaulting to a uuid, matching the supplyportal convention. */
export const pk = () => text('id').primaryKey().default(sql`gen_random_uuid()::text`);

/** created_at / updated_at pair used on almost every app table. */
export const timestamps = {
  created_at: timestamp('created_at').notNull().defaultNow(),
  updated_at: timestamp('updated_at').notNull().defaultNow(),
};

/**
 * Money: `numeric(14,2)`. Drizzle returns it as a string; the query layer in
 * `@bv/db/queries` coerces to number at the boundary. Big Ventures works in
 * whole KES but fuel unit prices carry cents.
 */
