import { sql } from 'drizzle-orm';
import { text, timestamp } from 'drizzle-orm/pg-core';

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
