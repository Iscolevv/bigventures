import { requirePermission, can } from '@/lib/session';
import { db } from '@bv/db';
import * as q from '@bv/db/queries';
import { PageHeader, StatTile, Badge, DataTable, dateTime, type Column } from '@/components/ui';
import { RescanButton, AlertRowActions } from '@/components/AlertActions';

export const dynamic = 'force-dynamic';

const SEV_TONE = { critical: 'crit', warning: 'warn', info: 'muted' } as const;

export default async function AlertsPage() {
  const user = await requirePermission('alert:read');
  const [rows, counts] = await Promise.all([q.openAlerts(db), q.alertCounts(db)]);
  const canAct = can(user.role, 'alert:update');

  const cols: Column<(typeof rows)[number]>[] = [
    { key: 'sev', header: '', render: (r) => <Badge tone={SEV_TONE[r.severity as 'info']}>{r.severity}</Badge> },
    { key: 'type', header: 'Type', render: (r) => <span className="capitalize text-muted">{r.type.replace(/_/g, ' ')}</span> },
    { key: 'title', header: 'Alert', render: (r) => <span className="font-medium">{r.title}</span> },
    { key: 'raised', header: 'Raised', render: (r) => <span className="text-muted">{dateTime(r.raised_at)}</span> },
    { key: 'status', header: 'Status', render: (r) => <Badge tone={r.status === 'acknowledged' ? 'brand' : 'muted'}>{r.status}</Badge> },
    ...(canAct
      ? [
          {
            key: 'act',
            header: '',
            align: 'right' as const,
            render: (r: (typeof rows)[number]) => <AlertRowActions id={r.id} status={r.status} />,
          },
        ]
      : []),
  ];

  return (
    <>
      <PageHeader
        title="Alerts & exceptions"
        subtitle="Everything that needs a look, in one place"
        actions={canAct ? <RescanButton /> : undefined}
      />
      <div className="grid grid-cols-3 gap-3">
        <StatTile label="Open" value={counts.total} tone={counts.total ? 'warn' : 'ok'} />
        <StatTile label="Critical" value={counts.critical} tone={counts.critical ? 'crit' : 'ok'} />
        <StatTile label="Warning" value={counts.warning} tone={counts.warning ? 'warn' : 'ok'} />
      </div>
      <div className="mt-6">
        <DataTable columns={cols} rows={rows} empty="No open alerts — all clear." />
      </div>
    </>
  );
}
