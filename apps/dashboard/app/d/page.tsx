import Link from 'next/link';
import { Camera, CheckCircle2, ChevronRight, ClipboardCheck, Clock, Plus, ShieldAlert, ShieldCheck, Truck, TriangleAlert, type LucideIcon } from 'lucide-react';
import { requireDriver } from '@/lib/driver-session';
import { db, schema, eq, desc, sql } from '@bv/db';
import { todaysVehicleCheck, driverPodBacklog } from '@bv/db/queries';
import { PO_UPLOAD_WINDOW_HOURS } from '@bv/core/reference';
import { PodBacklog } from '@/components/driver/PodBacklog';

export const dynamic = 'force-dynamic';

const STATUS: Record<string, { label: string; cls: string; icon: LucideIcon; ring: string }> = {
  draft: { label: 'Draft', cls: 'bg-muted/15 text-muted', icon: Clock, ring: 'bg-muted/15 text-muted' },
  submitted: { label: 'Sent to office', cls: 'bg-warn/15 text-warn', icon: Clock, ring: 'bg-warn/15 text-warn' },
  pre_check: { label: 'Ready to start', cls: 'bg-brand/15 text-brand', icon: Truck, ring: 'bg-brand/15 text-brand' },
  in_progress: { label: 'On the road', cls: 'bg-warn/15 text-warn', icon: Truck, ring: 'bg-warn/15 text-warn' },
  completed: { label: 'Approved', cls: 'bg-ok/15 text-ok', icon: CheckCircle2, ring: 'bg-ok/15 text-ok' },
  cancelled: { label: 'Cancelled', cls: 'bg-muted/15 text-muted', icon: Clock, ring: 'bg-muted/15 text-muted' },
  flagged: { label: 'Needs review', cls: 'bg-crit/15 text-crit', icon: TriangleAlert, ring: 'bg-crit/15 text-crit' },
};

export default async function DriverHome() {
  const me = await requireDriver();

  const todayCheck = await todaysVehicleCheck(db, me.driverId);

  const podBacklog = await driverPodBacklog(db, me.driverId, PO_UPLOAD_WINDOW_HOURS);

  const trips = await db
    .select({
      id: schema.trips.id,
      ref: schema.trips.reference_code,
      status: schema.trips.status,
      address: schema.trips.loading_point_address,
      startedAt: schema.trips.started_at,
      drops: sql<number>`(select count(*)::int from bigventures.drops dd where dd.trip_id = bigventures.trips.id)`,
      done: sql<number>`(select count(*)::int from bigventures.drops dd where dd.trip_id = bigventures.trips.id and dd.status not in ('pending','arrived'))`,
    })
    .from(schema.trips)
    .where(eq(schema.trips.driver_id, me.driverId))
    .orderBy(desc(schema.trips.created_at))
    .limit(40);

  const first = me.name.trim().split(/\s+/)[0];
  const today = new Date().toLocaleDateString('en-KE', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Africa/Nairobi' });

  return (
    <>
      <div className="mb-4">
        <h1 className="text-xl font-semibold">Hi, {first}</h1>
        <p className="text-sm text-muted">{today}</p>
      </div>

      {!todayCheck && (
        <Link
          href="/d/check"
          className="mb-4 flex items-center gap-3 rounded-2xl border border-warn/50 bg-warn/10 p-3.5 active:opacity-80"
        >
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-warn/20 text-warn">
            <ClipboardCheck size={22} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold text-warn">Do today&apos;s vehicle check</span>
            <span className="block text-xs text-muted">Once a day, before your first trip</span>
          </span>
          <ChevronRight size={20} className="shrink-0 text-warn" />
        </Link>
      )}
      {todayCheck?.overallResult === 'fail' && (
        <div className="mb-4 flex items-start gap-3 rounded-2xl border border-crit/50 bg-crit/10 p-3.5">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-crit/20 text-crit">
            <ShieldAlert size={22} />
          </span>
          <p className="text-sm font-semibold text-crit">
            Today&apos;s check flagged a critical fault. Contact the office before driving {todayCheck.registration}.
          </p>
        </div>
      )}
      {todayCheck && todayCheck.overallResult !== 'fail' && (
        <div className="mb-4 flex items-center gap-2 rounded-full bg-ok/10 px-3 py-1.5 text-xs font-medium text-ok">
          <ShieldCheck size={16} />
          {todayCheck.registration} checked today{todayCheck.overallResult === 'flagged' ? ' (minor issue noted)' : ''}
        </div>
      )}

      {podBacklog.length > 0 && (
        <div className="mb-4">
          <p className="mb-2 flex items-center gap-2 text-sm font-semibold">
            <Camera size={18} className="text-warn" />
            {podBacklog.length} PO{podBacklog.length === 1 ? '' : 's'} waiting for a photo ({PO_UPLOAD_WINDOW_HOURS}h limit)
          </p>
          <PodBacklog items={podBacklog} />
        </div>
      )}

      <Link
        href="/d/log"
        className="flex items-center justify-center gap-2 rounded-2xl bg-brand px-4 py-4 text-base font-semibold text-white shadow-md transition active:scale-[0.98] active:opacity-90"
      >
        <Plus size={22} strokeWidth={2.6} />
        Log a trip
      </Link>
      <p className="mt-2 text-center text-xs text-muted">List today&apos;s stops, same as you&apos;d text the group, just one place.</p>

      <h2 className="mb-2 mt-6 text-xs font-semibold uppercase tracking-wide text-muted">My trips</h2>
      <div className="space-y-2">
        {trips.length === 0 && (
          <div className="grid place-items-center rounded-2xl border border-dashed py-10 text-center">
            <span className="grid h-12 w-12 place-items-center rounded-full bg-brand/10 text-brand">
              <Truck size={24} />
            </span>
            <p className="mt-3 text-sm font-medium">No trips yet</p>
            <p className="mt-0.5 max-w-[16rem] text-xs text-muted">Tap Log a trip once you&apos;re done for the day and it will show up here.</p>
          </div>
        )}
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
  const Icon = s.icon;
  return (
    <Link href={`/d/t/${t.id}`} className="flex items-center gap-3 rounded-2xl border bg-surface p-3.5 transition active:bg-bg">
      <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-full ${s.ring}`}>
        <Icon size={20} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center justify-between gap-2">
          <span className="text-sm font-semibold">{t.ref}</span>
          <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${s.cls}`}>{s.label}</span>
        </span>
        <span className="wrap-anywhere mt-0.5 block truncate text-sm text-muted">{t.address}</span>
        <span className="mt-0.5 block text-xs text-muted">
          {t.done}/{t.drops} drops{t.startedAt ? ` · ${new Date(t.startedAt).toLocaleDateString('en-KE', { day: '2-digit', month: 'short' })}` : ''}
        </span>
      </span>
      <ChevronRight size={18} className="shrink-0 text-muted" />
    </Link>
  );
}
