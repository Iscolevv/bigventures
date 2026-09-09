import { defineConfig } from 'drizzle-kit';
import { config } from 'dotenv';

config({ path: ['.env', '../../.env'] });

export default defineConfig({
  schema: './src/schema/index.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL ?? '',
  },
  // This database is shared with other apps (Moody Treats). Only ever touch
  // our own schema — never diff or drop anything in `public`.
  schemaFilter: ['bigventures'],
  verbose: true,
  strict: true,
});
