import { config } from 'dotenv';
config({ path: ['.env', '../../.env'] });
import { neon } from '@neondatabase/serverless';

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL not set');
  const sql = neon(url);

  const schemas = await sql`
    select schema_name from information_schema.schemata
    where schema_name not in ('pg_catalog','information_schema','pg_toast')
    order by schema_name`;
  console.log('schemas:', schemas.map((s: { schema_name: string }) => s.schema_name).join(', '));

  const tables = await sql`
    select table_schema, table_name from information_schema.tables
    where table_schema not in ('pg_catalog','information_schema')
    order by table_schema, table_name`;
  const bySchema: Record<string, string[]> = {};
  for (const t of tables as { table_schema: string; table_name: string }[]) {
    (bySchema[t.table_schema] ??= []).push(t.table_name);
  }
  for (const [s, names] of Object.entries(bySchema)) {
    console.log(`\n${s} (${names.length}): ${names.join(', ')}`);
  }
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
