import { requirePermission, can } from '@/lib/session';
import { db, schema } from '@bv/db';
import * as q from '@bv/db/queries';
import { PAYMENT_METHODS } from '@bv/core/enums';
import { PageHeader, Card, DataTable, StatTile, Badge, kes, dateShort, ExportLink, type Column } from '@/components/ui';
import { GenerateInvoice, InvoiceStatusButton } from '@/components/InvoiceActions';
import { Pager, pageParam } from '@/components/Pager';
import { createManualInvoice, recordPayment } from './actions';

export const dynamic = 'force-dynamic';
const input = 'mt-1 w-full rounded-md border bg-surface px-3 py-2 text-sm';

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
  const today = new Date().toISOString().slice(0, 10);

  const [invResult, unbilled, summary] = await Promise.all([
    q.invoiceList(db, { page: pageParam(sp), pageSize: 20 }),
    q.unbilledTrips(db),
    q.invoiceSummary(db),
  ]);
  const invoices = invResult.rows;

  const clientsRaw = await db
    .select({ id: schema.clients.id, name: schema.clients.name })
    .from(schema.clients)
    .orderBy(schema.clients.name);
  const unbilledByClient = new Map<string, number>();
  for (const t of unbilled) {
    const c = clientsRaw.find((x) => x.name === t.client);
    if (c) unbilledByClient.set(c.id, (unbilledByClient.get(c.id) ?? 0) + 1);
  }
  const clientOptions = clientsRaw.map((c) => ({ ...c, unbilled: unbilledByClient.get(c.id) ?? 0 }));
  const noClientTrips = unbilled.filter((t) => !t.client).length;

  const canPay = can(user.role, 'payment:create');
  const cols: Column<(typeof invoices)[number]>[] = [
    { key: 'no', header: 'Invoice', render: (r) => <span className="font-medium">{r.number}</span> },
    { key: 'client', header: 'Client', render: (r) => r.client ?? '-' },
    { key: 'issue', header: 'Issued', render: (r) => <span className="text-muted">{dateShort(r.issueDate)}</span> },
    { key: 'due', header: 'Due', render: (r) => <span className={r.overdue ? 'text-crit' : 'text-muted'}>{dateShort(r.dueDate)}</span> },
    { key: 'lines', header: 'Lines', align: 'right', render: (r) => r.lines },
    { key: 'total', header: 'Total', align: 'right', render: (r) => kes(r.total) },
    { key: 'out', header: 'Outstanding', align: 'right', render: (r) => (r.outstanding > 0 ? kes(r.outstanding) : '-') },
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
            render: (r: (typeof invoices)[number]) => (
              <div className="flex flex-col items-end gap-1">
                <InvoiceStatusButton id={r.id} status={r.status} />
                {canPay && r.outstanding > 0 && r.status !== 'draft' && r.status !== 'void' && (
                  <details className="text-left">
                    <summary className="cursor-pointer rounded-md border px-2 py-1 text-xs hover:bg-bg">Record payment</summary>
                    <form action={recordPayment} className="mt-2 grid w-64 gap-2 rounded-lg border bg-surface p-3">
                      <input type="hidden" name="invoiceId" value={r.id} />
                      <label className="text-xs font-medium">
                        Amount received (Ksh)
                        <input name="amount" inputMode="decimal" required defaultValue={Math.round(r.outstanding)} className={input} />
                      </label>
                      <label className="text-xs font-medium">
                        Date
                        <input name="paidAt" type="date" defaultValue={today} className={input} />
                      </label>
                      <label className="text-xs font-medium">
                        Method
                        <select name="method" defaultValue="mpesa" className={`${input} capitalize`}>
                          {PAYMENT_METHODS.map((m) => (
                            <option key={m} value={m}>{m}</option>
                          ))}
                        </select>
                      </label>
                      <label className="text-xs font-medium">
                        Reference (optional)
                        <input name="reference" className={input} placeholder="M-Pesa code, cheque no." />
                      </label>
                      <button className="rounded-md bg-brand px-3 py-1.5 text-sm font-semibold text-white">Save payment</button>
                    </form>
                  </details>
                )}
              </div>
            ),
          },
        ]
      : []),
  ];

  return (
    <>
      <PageHeader title="Invoicing" subtitle={`${summary.count} invoices`} actions={<ExportLink type="invoices" />} />
      {sp.msg && <p className="mb-3 rounded-lg border border-ok/40 bg-ok/10 px-3 py-2 text-sm text-ok">{sp.msg}</p>}
      {sp.error && <p className="mb-3 rounded-lg border border-crit/40 bg-crit/10 px-3 py-2 text-sm text-crit">{sp.error}</p>}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Receivables" value={kes(summary.outstanding)} />
        <StatTile label="Overdue" value={kes(summary.overdue)} tone={summary.overdue > 0 ? 'crit' : 'ok'} />
        <StatTile label="Unbilled trips" value={unbilled.length} tone={unbilled.length ? 'warn' : 'ok'} hint={noClientTrips ? `${noClientTrips} have no client yet` : undefined} />
        <StatTile label="Flagged invoices" value={summary.flagged} tone={summary.flagged ? 'warn' : 'ok'} hint="linked trip has an unresolved issue" />
      </div>

      {can(user.role, 'invoice:create') && (
        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          <Card title="Invoice a client's approved trips">
            <p className="mb-3 text-xs text-muted">
              Uses the client and amount set when each trip was approved. Set or change them on the trip page.
            </p>
            <GenerateInvoice clients={clientOptions} />
          </Card>
          <Card title="Invoice something else">
            <form action={createManualInvoice} className="grid gap-3 sm:grid-cols-2">
              <label className="text-sm font-medium sm:col-span-2">
                Client
                <select name="clientId" required defaultValue="" className={input}>
                  <option value="" disabled>Select client…</option>
                  {clientsRaw.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </label>
              <label className="text-sm font-medium sm:col-span-2">
                What for
                <input name="description" required className={input} placeholder="e.g. Nairobi to Mombasa haul, 27 t" />
              </label>
              <label className="text-sm font-medium">
                Quantity
                <input name="quantity" inputMode="decimal" defaultValue="1" className={input} />
              </label>
              <label className="text-sm font-medium">
                Amount each (Ksh)
                <input name="unit" inputMode="decimal" required className={input} />
              </label>
              <div className="sm:col-span-2">
                <button className="rounded-md bg-brand px-4 py-2 text-sm font-semibold text-white">Create invoice</button>
              </div>
            </form>
          </Card>
        </div>
      )}

      <h2 className="mb-2 mt-6 text-sm font-semibold">Invoices</h2>
      <DataTable columns={cols} rows={invoices} empty="No invoices yet." />
      <Pager {...invResult} searchParams={sp} basePath="/invoicing" />
    </>
  );
}
