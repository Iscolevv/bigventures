import { drizzle } from 'drizzle-orm/neon-http';
import { neon } from '@neondatabase/serverless';
import * as schemaImport from './schema';

export * as schema from './schema';
export * from './schema';
export {
  sql,
  eq,
  ne,
  and,
  or,
  not,
  gt,
  gte,
  lt,
  lte,
  inArray,
  notInArray,
  isNull,
  isNotNull,
  between,
  like,
  ilike,
  desc,
  asc,
  count,
  countDistinct,
  sum,
  avg,
  min,
  max,
} from 'drizzle-orm';

/**
 * Lazy singleton — importing this module in a build step (no DATABASE_URL)
 * must not throw. Mirrors the supplyportal pattern.
 */
let _db: ReturnType<typeof makeDb> | null = null;

function makeDb() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is not set');
  return drizzle(neon(url), { schema: schemaImport });
}

export function getDb() {
  if (!_db) _db = makeDb();
  return _db;
}

export type DB = ReturnType<typeof getDb>;

export const db = new Proxy({} as ReturnType<typeof makeDb>, {
  get(_t, prop) {
    const real = getDb() as object;
    const value = Reflect.get(real, prop);
    return typeof value === 'function' ? value.bind(real) : value;
  },
});
