import { config } from 'dotenv';
config({ path: ['.env', '../../.env'] });
import { drizzle } from 'drizzle-orm/neon-http';
import { neon } from '@neondatabase/serverless';
import { migrate } from 'drizzle-orm/neon-http/migrator';
import { sql } from 'drizzle-orm';

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is not set');
  const db = drizzle(neon(url));

  // This DB is shared (Moody Treats). Everything Big Ventures owns lives in the
  // `bigventures` schema, including the migration bookkeeping table — so we
  // never touch `public` or Moody Treats' own drizzle metadata.
  await db.execute(sql`CREATE SCHEMA IF NOT EXISTS "bigventures"`);

  console.log('running migrations into schema "bigventures"…');
  await migrate(db, { migrationsFolder: './drizzle', migrationsSchema: 'bigventures' });
  console.log('done');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
