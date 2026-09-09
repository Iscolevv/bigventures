import { requirePermission } from '@/lib/session';
import { db } from '@bv/db';
import * as q from '@bv/db/queries';
import { PageHeader, DataTable, Badge, dateTime, type Column } from '@/components/ui';

export const dynamic = 'force-dynamic';

const ACTION_TONE: Record<string, 'ok' | 'warn' | 'crit' | 'muted' | 'brand'> = {
  create: 'ok',
  update: 'brand',
  delete: 'crit',
  approve: 'ok',
  reject: 'crit',
  override: 'warn',
  export: 'muted',
  login: 'muted',
  sync: 'muted',
};

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requirePermission('audit:read');
  const sp = await searchParams;
  const [rows, types] = await Promise.all([
    q.auditTrail(db, { entityType: sp.entity, limit: 300 }),
    q.auditEntityTypes(db),
  ]);

  const cols: Column<(typeof rows)[number]>[] = [
    { key: 'at', header: 'When', render: (r) => <span className="text-muted">{dateTime(r.at)}</span> },
    { key: 'actor', header: 'Actor', render: (r) => <span className="font-medium">{r.actor ?? 'system'}</span> },
    { key: 'role', header: 'Role', render: (r) => <span className="capitalize text-muted">{r.actorRole ?? '—'}</span> },
    { key: 'action', header: 'Action', render: (r) => <Badge tone={ACTION_TONE[r.action] ?? 'muted'}>{r.action}</Badge> },
    { key: 'entity', header: 'Entity', render: (r) => <span className="text-muted">{r.entityType}:{r.entityId.slice(0, 8)}</span> },
    { key: 'src', header: 'Source', render: (r) => <span className="text-muted">{r.source ?? '—'}</span> },
  ];

  return (
    <>
      <PageHeader title="Audit trail" subtitle={`${rows.length} recent events`} />
      <div className="mb-4 flex flex-wrap gap-2 text-sm">
        <a href="/audit" className={`rounded-md border px-3 py-1.5 ${!sp.entity ? 'bg-brand text-white' : 'hover:bg-bg'}`}>
          All
        </a>
        {types.map((t) => (
          <a
            key={t.t}
            href={`/audit?entity=${t.t}`}
            className={`rounded-md border px-3 py-1.5 ${sp.entity === t.t ? 'bg-brand text-white' : 'hover:bg-bg'}`}
          >
            {t.t} ({t.n})
          </a>
        ))}
      </div>
      <DataTable columns={cols} rows={rows} empty="No audit events yet." />
    </>
  );
}
