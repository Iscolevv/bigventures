import { requirePermission } from '@/lib/session';
import { db } from '@bv/db';
import * as q from '@bv/db/queries';
import { PageHeader, DataTable, StatTile, Badge, dateShort, type Column } from '@/components/ui';

export const dynamic = 'force-dynamic';

function tone(status: string, days: number | null): 'ok' | 'warn' | 'crit' | 'muted' {
  if (status === 'expired' || (days != null && days < 0)) return 'crit';
  if (status === 'expiring_soon' || (days != null && days < 45)) return 'warn';
  if (status === 'pending_review') return 'warn';
  if (status === 'rejected' || status === 'missing') return 'crit';
  return 'ok';
}

export default async function DocumentsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requirePermission('document:read');
  const sp = await searchParams;
  const all = await q.documentList(db);
  const rows = sp.owner ? all.filter((d) => d.ownerType === sp.owner) : all;

  const expired = all.filter((d) => d.status === 'expired' || (d.daysToExpiry != null && d.daysToExpiry < 0)).length;
  const expiring = all.filter((d) => d.daysToExpiry != null && d.daysToExpiry >= 0 && d.daysToExpiry < 45).length;
  const pending = all.filter((d) => d.status === 'pending_review').length;

  const cols: Column<(typeof rows)[number]>[] = [
    { key: 'owner', header: 'Owner', render: (r) => <span className="font-medium">{r.ownerName}</span> },
    { key: 'type', header: 'Type', render: (r) => <span className="capitalize">{r.docType.replace(/_/g, ' ')}</span> },
    { key: 'ownert', header: 'Scope', render: (r) => <span className="capitalize text-muted">{r.ownerType}</span> },
    { key: 'issue', header: 'Issued', render: (r) => <span className="text-muted">{dateShort(r.issueDate)}</span> },
    { key: 'exp', header: 'Expires', render: (r) => (r.expiryDate ? dateShort(r.expiryDate) : <span className="text-muted">n/a</span>) },
    {
      key: 'days',
      header: 'Days left',
      align: 'right',
      render: (r) => (r.daysToExpiry == null ? '—' : <span className={r.daysToExpiry < 45 ? 'text-crit' : ''}>{r.daysToExpiry}</span>),
    },
    { key: 'status', header: 'Status', render: (r) => <Badge tone={tone(r.status, r.daysToExpiry)}>{r.status.replace('_', ' ')}</Badge> },
  ];

  return (
    <>
      <PageHeader
        title="Documents"
        subtitle={`${all.length} documents — drivers, vehicles & company`}
      />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Total" value={all.length} />
        <StatTile label="Expired" value={expired} tone={expired ? 'crit' : 'ok'} />
        <StatTile label="Expiring < 45d" value={expiring} tone={expiring ? 'warn' : 'ok'} />
        <StatTile label="Pending review" value={pending} tone={pending ? 'warn' : 'ok'} />
      </div>
      <div className="mb-4 mt-6 flex gap-2 text-sm">
        {['', 'driver', 'vehicle', 'company'].map((o) => (
          <a
            key={o}
            href={o ? `/documents?owner=${o}` : '/documents'}
            className={`rounded-md border px-3 py-1.5 ${(sp.owner ?? '') === o ? 'bg-brand text-white' : 'hover:bg-bg'}`}
          >
            {o ? o[0]!.toUpperCase() + o.slice(1) : 'All'}
          </a>
        ))}
      </div>
      <DataTable columns={cols} rows={rows} />
    </>
  );
}
