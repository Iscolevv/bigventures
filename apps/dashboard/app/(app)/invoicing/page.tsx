import { requirePermission, can } from '@/lib/session';
import { db, schema, sql, eq } from '@bv/db';
import * as q from '@bv/db/queries';
import { PageHeader, Card, DataTable, StatTile, Badge, kes, dateShort, ExportLink, type Column } from '@/components/ui';
import { GenerateInvoice, InvoiceStatusButton } from '@/components/InvoiceActions';
import { Pager, pageParam } from '@/components/Pager';

export const dynamic = 'force-dynamic';

const STATUS_TONE: Record<string, 'ok' | 'warn' | 'crit' | 'muted' | 'brand'> = {
  paid: 'ok',
  part_paid: 'warn',
  issued: 'brand',
  draft: 'muted',
  overdue: 'crit',
  void: 'muted',
};

export default async function InvoicingPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const user = await requirePermission('invoice:read');
  const sp = await searchParams;

  const [invResult, unbilled, summary] = await Promise.all([
    q.invoiceList(db, { page: pageParam(sp), pageSize: 20 }),
    q.unbilledTrips(db),
    q.invoiceSummary(db),
  ]);
  const invoices = invResult.rows;

  // unbilled trips grouped by client, for the generate control
  const clientsRaw = await db
    .select({ id: schema.clients.id, name: schema.clients.name })
    .from(schema.clients)
    .orderBy(schema.clients.name);
  const unbilledByClient = new Map<string, number>();
  for (const t of unbilled) {
    // unbilled rows carry client name; map to id
    const c = clientsRaw.find((x) => x.name === t.client);
    if (c) unbilledByClient.set(c.id, (unbilledByClient.get(c.id) ?? 0) + 1);
  }
  const clientOptions = clientsRaw.map((c) => ({ ...c, unbilled: unbilledByClient.get(c.id) ?? 0 }));

  const outstanding = summary.outstanding;
  const overdue = summary.overdue;
  const flagged = summary.flagged;

  const cols: Column<(typeof invoices)[number]>[] = [
    { key: 'no', header: 'Invoice', render: (r) => <span className="font-medium">{r.number}</span> },
    { key: 'client', header: 'Client', render: (r) => r.client ?? '—' },
    { key: 'issue', header: 'Issued', render: (r) => <span className="text-muted">{dateShort(r.issueDate)}</span> },
    { key: 'due', header: 'Due', render: (r) => <span className={r.overdue ? 'text-crit' : 'text-muted'}>{dateShort(r.dueDate)}</span> },
    { key: 'lines', header: 'Lines', align: 'right', render: (r) => r.lines },
    { key: 'total', header: 'Total', align: 'right', render: (r) => kes(r.total) },
    { key: 'out', header: 'Outstanding', align: 'right', render: (r) => (r.outstanding > 0 ? kes(r.outstanding) : '—') },
    {
      key: 'status',
      header: 'Status',
      render: (r) => (
        <span className="flex items-center gap-1">
          <Badge tone={r.overdue ? 'crit' : STATUS_TONE[r.status] ?? 'muted'}>{r.overdue ? 'overdue' : r.status.replace('_', ' ')}</Badge>
          {r.hasIssues && <Badge tone="warn">⚠ issues</Badge>}
        </span>
      ),
    },
    ...(can(user.role, 'invoice:update')
      ? [
          {
            key: 'act',
            header: '',
            align: 'right' as const,
            render: (r: (typeof invoices)[number]) => <InvoiceStatusButton id={r.id} status={r.status} />,
          },
        ]
      : []),
  ];

  return (
    <>
      <PageHeader title="Invoicing" subtitle={`${summary.count} invoices`} actions={<ExportLink type="invoices" />} />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Receivables" value={kes(outstanding)} />
        <StatTile label="Overdue" value={kes(overdue)} tone={overdue > 0 ? 'crit' : 'ok'} />
        <StatTile label="Unbilled trips" value={unbilled.length} tone={unbilled.length ? 'warn' : 'ok'} />
        <StatTile label="Flagged invoices" value={flagged} tone={flagged ? 'warn' : 'ok'} hint="linked trip has an unresolved issue" />
      </div>

      {can(user.role, 'invoice:create') && (
        <Card title="Generate invoice from delivered trips" className="mt-6">
          <GenerateInvoice clients={clientOptions} />
        </Card>
      )}

      <h2 className="mb-2 mt-6 text-sm font-semibold">Invoices</h2>
      <DataTable columns={cols} rows={invoices} empty="No invoices yet." />
      <Pager {...invResult} searchParams={sp} basePath="/invoicing" />
    </>
  );
}
