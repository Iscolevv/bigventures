import { NextResponse } from 'next/server';
import { db, sql } from '@bv/db';
import { assertCron } from '@/lib/cron';
import { runAlertScan } from '@/lib/alert-engine';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * Nightly maintenance (Vercel Cron → see vercel.json):
 *  1. refresh document `status` from expiry dates
 *  2. refresh driver advance / loss balances from the ledger
 *  3. refresh vehicle odometer cache from the latest fuel/trip reading
 *  4. run the alert scan
 */
export async function GET(req: Request) {
  const bad = assertCron(req);
  if (bad) return bad;

  // 1. document status
  await db.execute(sql`
    update bigventures.documents set status = case
      when expiry_date is null then (case when status = 'pending_review' then 'pending_review' else 'valid' end)
      when expiry_date < current_date then 'expired'
      when expiry_date < current_date + 45 then 'expiring_soon'
      else 'valid'
    end
    where status not in ('pending_review','rejected')
  `);

  // 2. advance + loss balances
  await db.execute(sql`
    update bigventures.drivers d set advance_balance = coalesce((
      select sum(case when a.direction = 'disbursed' then a.amount::numeric else -a.amount::numeric end)
      from bigventures.advances a where a.driver_id = d.id
    ), 0)
  `);

  // 3. odometer cache
  await db.execute(sql`
    update bigventures.vehicles v set odometer_km = greatest(v.odometer_km::numeric, coalesce((
      select max(x) from (
        select max(end_odometer_km::numeric) as x from bigventures.trips where vehicle_id = v.id
        union all
        select max(odometer_km::numeric) from bigventures.fuel_entries where vehicle_id = v.id
      ) s
    ), v.odometer_km::numeric))
  `);

  // 4. alerts
  const raised = await runAlertScan(db);

  return NextResponse.json({ ok: true, alertsRaised: raised, at: new Date().toISOString() });
}
