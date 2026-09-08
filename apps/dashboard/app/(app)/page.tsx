import { requireDashboardUser } from '@/lib/session';
import { db, schema, sql } from '@bv/db';
import { PageHeader, StatTile, Card, EmptyState } from '@/components/ui';

async function counts() {
  const [v] = await db.select({ n: sql<number>`count(*)::int` }).from(schema.vehicles);
  const [d] = await db.select({ n: sql<number>`count(*)::int` }).from(schema.drivers);
  const [openAlerts] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(schema.alerts)
    .where(sql`${schema.alerts.status} in ('open','acknowledged')`);
  const [activeTrips] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(schema.trips)
    .where(sql`${schema.trips.status} in ('in_progress','pre_check')`);
  return {
    vehicles: v?.n ?? 0,
    drivers: d?.n ?? 0,
    openAlerts: openAlerts?.n ?? 0,
    activeTrips: activeTrips?.n ?? 0,
  };
}

export default async function OverviewPage() {
  const user = await requireDashboardUser();
  const c = await counts();

  return (
    <>
      <PageHeader title={`Welcome, ${user.name.split(' ')[0]}`} subtitle="Fleet snapshot" />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatTile label="Vehicles" value={c.vehicles} />
        <StatTile label="Drivers" value={c.drivers} />
        <StatTile label="Trips in progress" value={c.activeTrips} />
        <StatTile
          label="Open alerts"
          value={c.openAlerts}
          tone={c.openAlerts > 0 ? 'warn' : 'ok'}
        />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="text-sm font-semibold">Today&apos;s deliveries</h2>
          <p className="mt-2 text-xs text-muted">
            Trip and drop feed lands here once the driver app is syncing (Phase 1).
          </p>
        </Card>
        <Card>
          <h2 className="text-sm font-semibold">Exceptions</h2>
          <p className="mt-2 text-xs text-muted">
            Failed checks, delivery issues, fuel anomalies, document expiries and overdue advances
            surface here (Phase 3).
          </p>
        </Card>
      </div>

      <div className="mt-6">
        <EmptyState
          title="Analytics warm up as data arrives"
          hint="Seed the demo dataset with pnpm db:seed, then start logging trips from the mobile app."
        />
      </div>
    </>
  );
}
