import Link from 'next/link';
import { requireDriver } from '@/lib/driver-session';
import { db, schema, eq, and, desc, sql } from '@bv/db';
import { todaysVehicleCheck } from '@bv/db/queries';

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

  const [myVehicle] = await db
    .select({ id: schema.vehicles.id, reg: schema.vehicles.registration })
    .from(schema.vehicleAssignments)
    .innerJoin(schema.vehicles, eq(schema.vehicles.id, schema.vehicleAssignments.vehicle_id))
    .where(and(eq(schema.vehicleAssignments.driver_id, me.driverId), sql`${schema.vehicleAssignments.end_date} is null`))
    .orderBy(schema.vehicles.registration)
    .limit(1);
  const todayCheck = myVehicle ? await todaysVehicleCheck(db, me.driverId, myVehicle.id) : null;

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

  return (
    <>
      {myVehicle && !todayCheck && (
        <Link
          href="/d/check"
          className="mb-4 block rounded-xl border border-warn bg-warn/10 px-4 py-3 text-sm font-semibold text-warn active:opacity-80"
        >
          Do today&apos;s vehicle check for {myVehicle.reg} →
        </Link>
      )}
      {myVehicle && todayCheck?.overallResult === 'fail' && (
        <div className="mb-4 rounded-xl border border-crit bg-crit/10 px-4 py-3 text-sm font-semibold text-crit">
          Today&apos;s check flagged a critical fault - contact the office before driving {myVehicle.reg}.
        </div>
      )}
      {myVehicle && todayCheck && todayCheck.overallResult !== 'fail' && (
        <p className="mb-4 text-xs text-muted">✓ {myVehicle.reg} checked today{todayCheck.overallResult === 'flagged' ? ' (minor issue noted)' : ''}</p>
      )}

      <h1 className="text-lg font-semibold">My trips</h1>
      <Link
        href="/d/log"
        className="mt-3 block rounded-xl bg-brand px-4 py-3.5 text-center text-base font-semibold text-white active:opacity-90"
      >
        Log a trip
      </Link>
      <p className="mt-2 text-center text-xs text-muted">List today&apos;s stops - same as you&apos;d text the group, just one place.</p>

      <div className="mt-6 space-y-2">
        {trips.length === 0 && <p className="text-sm text-muted">No trips yet. Tap “Log a trip” once you&apos;re done for the day.</p>}
        {trips.map((t) => (
          <TripCard key={t.id} t={t} />
        ))}
      </div>
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
    <Link href={`/d/t/${t.id}`} className="block rounded-xl border bg-surface p-3.5 active:bg-bg">
      <div className="flex items-start justify-between gap-2">
        <span className="text-sm font-semibold">{t.ref}</span>
        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${s.cls}`}>{s.label}</span>
      </div>
      <p className="wrap-anywhere mt-1 text-sm text-muted">{t.address}</p>
      <p className="mt-1 text-xs text-muted">
        {t.done}/{t.drops} drops{t.startedAt ? ` · ${new Date(t.startedAt).toLocaleDateString('en-KE', { day: '2-digit', month: 'short' })}` : ''}
      </p>
    </Link>
  );
}
