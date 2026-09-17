import { requirePermission } from '@/lib/session';
import { db } from '@bv/db';
import * as q from '@bv/db/queries';
import { PageHeader } from '@/components/ui';
import { CalendarView } from '@/components/CalendarView';

export const dynamic = 'force-dynamic';

/** Kenya is UTC+3 with no DST - shifting before slicing buckets a timestamp
 *  into the Nairobi calendar day it actually happened on, not the UTC one. */
function nairobiDateKey(d: Date) {
  return new Date(d.getTime() + 3 * 3600 * 1000).toISOString().slice(0, 10);
}

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requirePermission('trip:read');
  const sp = await searchParams;

  const now = new Date();
  const year = sp.y ? Number(sp.y) : now.getUTCFullYear();
  const month = sp.m ? Number(sp.m) : now.getUTCMonth() + 1; // 1-12, human-readable

  const from = new Date(Date.UTC(year, month - 1, 1));
  const to = new Date(Date.UTC(year, month, 1));

  const result = await q.tripList(db, { from, to, pageSize: 1000 });

  const trips = result.rows
    .filter((t) => t.startedAt)
    .map((t) => ({
      id: t.id,
      ref: t.ref,
      status: t.status,
      vehicle: t.vehicle,
      driver: t.driver,
      drops: t.drops,
      issues: t.issues,
      date: nairobiDateKey(t.startedAt!),
    }));

  return (
    <>
      <PageHeader title="Trip calendar" subtitle="Click a date to see every trip logged that day" />
      <CalendarView year={year} month={month} trips={trips} todayKey={nairobiDateKey(now)} />
    </>
  );
}
