import Link from 'next/link';
import { requireDriver } from '@/lib/driver-session';
import { db, schema, eq, desc, sql } from '@bv/db';

export const dynamic = 'force-dynamic';

const STATUS: Record<string, { label: string; cls: string }> = {
  draft: { label: 'Draft', cls: 'bg-muted/15 text-muted' },
  pre_check: { label: 'Ready to start', cls: 'bg-brand/15 text-brand' },
  in_progress: { label: 'On the road', cls: 'bg-warn/15 text-warn' },
  completed: { label: 'Done', cls: 'bg-ok/15 text-ok' },
  cancelled: { label: 'Cancelled', cls: 'bg-muted/15 text-muted' },
  flagged: { label: 'Needs review', cls: 'bg-crit/15 text-crit' },
};

export default async function DriverHome() {
  const me = await requireDriver();

  const trips = await db
    .select({
      id: schema.trips.id,
      ref: schema.trips.reference_code,
      status: schema.trips.status,
      address: schema.trips.loading_point_address,
      startedAt: schema.trips.started_at,
      drops: sql<number>`(select count(*)::int from ${schema.drops} where ${schema.drops.trip_id} = ${schema.trips.id})`,
      done: sql<number>`(select count(*)::int from ${schema.drops} where ${schema.drops.trip_id} = ${schema.trips.id} and ${schema.drops.status} not in ('pending','arrived'))`,
    })
    .from(schema.trips)
    .where(eq(schema.trips.driver_id, me.driverId))
    .orderBy(desc(schema.trips.created_at))
    .limit(40);

  const active = trips.filter((t) => t.status !== 'completed' && t.status !== 'cancelled');
  const past = trips.filter((t) => t.status === 'completed' || t.status === 'cancelled');

  return (
    <>
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">My trips</h1>
        <Link href="/d/new" className="rounded-lg bg-brand px-3 py-2 text-sm font-medium text-white">
          Start a trip
        </Link>
      </div>

      <h2 className="mt-5 text-xs font-semibold uppercase tracking-wide text-muted">Active</h2>
      {active.length === 0 && <p className="mt-2 text-sm text-muted">Nothing running. Tap “Start a trip”.</p>}
      <div className="mt-2 space-y-2">
        {active.map((t) => (
          <TripCard key={t.id} t={t} />
        ))}
      </div>

      {past.length > 0 && (
        <>
          <h2 className="mt-6 text-xs font-semibold uppercase tracking-wide text-muted">Recent</h2>
          <div className="mt-2 space-y-2">
            {past.slice(0, 10).map((t) => (
              <TripCard key={t.id} t={t} />
            ))}
          </div>
        </>
      )}
    </>
  );
}

function TripCard({
  t,
}: {
  t: { id: string; ref: string; status: string; address: string; startedAt: Date | null; drops: number; done: number };
}) {
  const s = STATUS[t.status] ?? STATUS.draft!;
  return (
    <Link href={`/d/t/${t.id}`} className="block rounded-xl border bg-surface p-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold">{t.ref}</span>
        <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${s.cls}`}>{s.label}</span>
      </div>
      <p className="mt-1 text-sm text-muted">{t.address}</p>
      <p className="mt-1 text-xs text-muted">
        {t.done}/{t.drops} drops{t.startedAt ? ` · ${new Date(t.startedAt).toLocaleDateString('en-KE', { day: '2-digit', month: 'short' })}` : ''}
      </p>
    </Link>
  );
}
