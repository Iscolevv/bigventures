/**
 * Reset people + fleet to exactly what is on the original fleet sheet:
 *  - drivers: the exact names in the PDF's latest (August) driver list, nothing else on file
 *  - fleet: the 8 registrations, no invented make/model/odometer
 *  - Kevin and Raha become admins
 *
 *   cd apps/dashboard
 *   node --env-file=../../.env --import tsx scripts/reset-people.ts [driverPassword]
 */
import { db, schema, sql } from '@bv/db';
import { createDriver } from '../lib/people';

const PASSWORD = process.argv[2] ?? 'driver1234';
const DRIVERS = [
  'Nahashon Gitau', 'Alex Kibui', 'Stephen Mwangi', 'Ezekiel', 'Willi',
  'Dismas', 'Tony', 'Raha Kabui', 'Kevin Mwangi', 'Jacinta Michaels',
];

async function main() {
  await db.execute(sql`delete from bigventures.vehicle_assignments`);
  await db.execute(sql`delete from bigventures.drivers`);
  await db.execute(sql`delete from bigventures.account where "userId" in (select id from bigventures."user" where role = 'driver')`);
  await db.execute(sql`delete from bigventures."user" where role = 'driver'`);

  for (const name of DRIVERS) {
    const r = await createDriver({ name, password: PASSWORD });
    console.log('driver', name.padEnd(18), r.driverId.slice(0, 8));
  }

  await db.execute(sql`update bigventures.vehicles set make = null, model = null, year = null, odometer_km = '0',
    acquisition_date = null, acquisition_cost = null, monthly_finance_cost = '0',
    last_service_odometer_km = null, next_service_due_km = null, next_service_due_date = null, notes = null`);

  await db.execute(sql`update bigventures."user" set role = 'admin', phone = null, name = case email
      when 'kevin@bigventures.demo' then 'Kevin' when 'raha@bigventures.demo' then 'Raha' else name end
    where email in ('kevin@bigventures.demo', 'raha@bigventures.demo')`);
  await db.execute(sql`update bigventures."user" set phone = null where role <> 'driver'`);

  const u = await db.execute(sql`select email, name, role from bigventures."user" order by role, email`);
  console.table(u.rows);
  const v = await db.execute(sql`select registration from bigventures.vehicles order by 1`);
  console.log('fleet:', (v.rows as { registration: string }[]).map((x) => x.registration).join(', '));
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
