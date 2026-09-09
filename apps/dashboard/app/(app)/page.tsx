import Link from 'next/link';
import { requireDashboardUser } from '@/lib/session';
import { db } from '@bv/db';
import * as q from '@bv/db/queries';
import { PageHeader, StatTile, Card, Badge, kes, dateTime } from '@/components/ui';
import { resolvePeriod } from '@/lib/period';

export const dynamic = 'force-dynamic';

export default async function OverviewPage() {
  const user = await requireDashboardUser();
  const p = resolvePeriod('30d');

  const [fleet, tripsSum, fin, alerts, recentTrips] = await Promise.all([
    q.fleetSummary(db),
    q.tripsSummary(db, p.from, p.to),
    q.financeSummary(db, p),
    q.alertCounts(db),
    q.tripList(db, { limit: 8 }),
  ]);

  const grossProfit = fin.revenue - fin.fuelCost - fin.runningCost;

  return (
    <>
      <PageHeader
        title={`Welcome, ${user.name.split(' ')[0]}`}
        subtitle={`Snapshot — ${p.label}`}
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Trips (30d)" value={tripsSum.total} hint={`${tripsSum.flagged} flagged · ${tripsSum.inProgress} live`} tone={tripsSum.flagged > 0 ? 'warn' : 'default'} />
        <StatTile label="Revenue (30d)" value={kes(fin.revenue)} />
        <StatTile label="Gross profit (30d)" value={kes(grossProfit)} hint={`fuel ${kes(fin.fuelCost)} · running ${kes(fin.runningCost)}`} tone={grossProfit >= 0 ? 'ok' : 'crit'} />
        <StatTile label="Open alerts" value={alerts.total} hint={`${alerts.critical} critical · ${alerts.warning} warning`} tone={alerts.critical > 0 ? 'crit' : alerts.total > 0 ? 'warn' : 'ok'} />
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Vehicles" value={`${fleet.vehiclesActive}/${fleet.vehicles}`} hint={`${fleet.vehiclesInRepair} in repair`} />
        <StatTile label="Drivers" value={fleet.driversActive} />
        <StatTile label="Receivables" value={kes(fin.receivablesOutstanding)} hint={`${kes(fin.receivablesOverdue)} overdue`} tone={fin.receivablesOverdue > 0 ? 'warn' : 'default'} />
        <StatTile label="Completed (30d)" value={tripsSum.completed} />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <Card title="Recent trips" className="lg:col-span-2">
          <div className="divide-y">
            {recentTrips.map((t) => (
              <Link key={t.id} href={`/trips/${t.id}`} className="flex items-center justify-between py-2.5 text-sm hover:opacity-80">
                <div>
                  <span className="font-medium">{t.ref}</span>{' '}
                  <span className="text-muted">
                    {t.vehicle} · {t.driver}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-muted">{t.drops} drops</span>
                  {t.issues > 0 && <Badge tone="warn">{t.issues} issue</Badge>}
                  <span className="text-muted">{dateTime(t.startedAt)}</span>
                </div>
              </Link>
            ))}
            {recentTrips.length === 0 && <p className="py-4 text-sm text-muted">No trips yet.</p>}
          </div>
        </Card>

        <Card title="Alerts by type">
          {Object.keys(alerts.byType).length === 0 ? (
            <p className="text-sm text-muted">All clear.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {Object.entries(alerts.byType).map(([type, n]) => (
                <li key={type} className="flex justify-between">
                  <span className="capitalize">{type.replace(/_/g, ' ')}</span>
                  <span className="font-medium tabular-nums">{n}</span>
                </li>
              ))}
            </ul>
          )}
          <Link href="/alerts" className="mt-4 inline-block text-xs font-medium text-brand">
            Open alerts panel →
          </Link>
        </Card>
      </div>
    </>
  );
}
