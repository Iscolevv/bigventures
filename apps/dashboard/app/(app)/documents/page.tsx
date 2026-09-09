import { requirePermission, can } from '@/lib/session';
import { db, schema } from '@bv/db';
import * as q from '@bv/db/queries';
import { PageHeader, DataTable, StatTile, Badge, dateShort, type Column } from '@/components/ui';
import { Pager, pageParam } from '@/components/Pager';
import { UploadDocument } from '@/components/UploadDocument';

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
  const user = await requirePermission('document:read');
  const sp = await searchParams;

  const canUpload = can(user.role, 'document:create');
  const [result, summary, drivers, vehicles] = await Promise.all([
    q.documentList(db, { ownerType: sp.owner, page: pageParam(sp), pageSize: 30 }),
    q.documentSummary(db),
    canUpload
      ? db.select({ id: schema.drivers.id, name: schema.drivers.full_name }).from(schema.drivers).orderBy(schema.drivers.full_name)
      : Promise.resolve([]),
    canUpload
      ? db.select({ id: schema.vehicles.id, name: schema.vehicles.registration }).from(schema.vehicles).orderBy(schema.vehicles.registration)
      : Promise.resolve([]),
  ]);
  const rows = result.rows;

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
        subtitle={`${summary.total} documents — drivers, vehicles & company`}
        actions={canUpload ? <UploadDocument drivers={drivers} vehicles={vehicles} /> : undefined}
      />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Total" value={summary.total} />
        <StatTile label="Expired" value={summary.expired} tone={summary.expired ? 'crit' : 'ok'} />
        <StatTile label="Expiring < 45d" value={summary.expiring} tone={summary.expiring ? 'warn' : 'ok'} />
        <StatTile label="Pending review" value={summary.pending} tone={summary.pending ? 'warn' : 'ok'} />
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
      <Pager {...result} searchParams={sp} basePath="/documents" />
    </>
  );
}
