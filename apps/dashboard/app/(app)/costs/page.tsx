import { requirePermission } from '@/lib/session';
import { db } from '@bv/db';
import * as q from '@bv/db/queries';
import { PageHeader, Card, DataTable, StatTile, Badge, kes, dateShort, ExportLink, type Column } from '@/components/ui';
import { BarChartCard } from '@/components/Charts';
import { PeriodTabs } from '@/components/PeriodTabs';
import { Pager, pageParam } from '@/components/Pager';
import { resolvePeriod } from '@/lib/period';

export const dynamic = 'force-dynamic';

export default async function CostsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requirePermission('cost:read');
  const sp = await searchParams;
  const p = resolvePeriod(sp.period);

  const [byCat, entriesResult, advances, summary] = await Promise.all([
    q.costsByCategory(db, p),
    q.costEntryList(db, { from: p.from, to: p.to, page: pageParam(sp), pageSize: 25 }),
    q.advanceLedger(db),
    q.costSummary(db, p),
  ]);
  const entries = entriesResult.rows;

  const totalCosts = summary.total;
  const totalAdvances = advances.reduce((s, a) => s + a.balance, 0);
  const totalLoss = advances.reduce((s, a) => s + a.lossBalance, 0);

  const costCols: Column<(typeof entries)[number]>[] = [
    { key: 'date', header: 'Date', render: (r) => <span className="text-muted">{dateShort(r.incurredAt)}</span> },
    { key: 'cat', header: 'Category', render: (r) => <span className="capitalize">{r.category}</span> },
    { key: 'desc', header: 'Description', render: (r) => r.description ?? '—' },
    { key: 'veh', header: 'Vehicle', render: (r) => <span className="text-muted">{r.vehicle ?? '—'}</span> },
    { key: 'amt', header: 'Amount', align: 'right', render: (r) => kes(r.amount) },
    {
      key: 'status',
      header: 'Status',
      render: (r) => <Badge tone={r.status === 'approved' ? 'ok' : r.status === 'rejected' ? 'crit' : 'warn'}>{r.status}</Badge>,
    },
  ];

  const advCols: Column<(typeof advances)[number]>[] = [
    { key: 'd', header: 'Driver', render: (r) => <span className="font-medium">{r.driver}</span> },
    { key: 'disb', header: 'Disbursed', align: 'right', render: (r) => kes(r.disbursed) },
    { key: 'rep', header: 'Repaid', align: 'right', render: (r) => kes(r.repaid) },
    {
      key: 'bal',
      header: 'Balance',
      align: 'right',
      render: (r) => <span className={r.balance > 20000 ? 'text-warn' : ''}>{kes(r.balance)}</span>,
    },
    { key: 'loss', header: 'Loss bal.', align: 'right', render: (r) => (r.lossBalance > 0 ? <span className="text-crit">{kes(r.lossBalance)}</span> : '—') },
    { key: 'last', header: 'Last activity', render: (r) => <span className="text-muted">{dateShort(r.lastActivity)}</span> },
  ];

  return (
    <>
      <PageHeader title="Costs & advances" subtitle={p.label} actions={<div className="flex gap-2"><ExportLink type="costs" /><PeriodTabs current={p.key} /></div>} />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Running costs" value={kes(totalCosts)} />
        <StatTile label="Pending approval" value={summary.pendingCount} tone={summary.pendingCount ? 'warn' : 'ok'} hint={kes(summary.pendingAmount)} />
        <StatTile label="Advances outstanding" value={kes(totalAdvances)} />
        <StatTile label="At-fault losses" value={kes(totalLoss)} tone={totalLoss ? 'crit' : 'ok'} />
      </div>

      <Card title="Cost by category" className="mt-6">
        {byCat.length ? (
          <BarChartCard
            data={byCat.map((c) => ({ category: c.category, total: c.total }))}
            xKey="category"
            yKey="total"
            format="kes"
          />
        ) : (
          <p className="text-sm text-muted">No costs recorded in this window.</p>
        )}
      </Card>

      <h2 className="mb-2 mt-6 text-sm font-semibold">Cost entries</h2>
      <DataTable columns={costCols} rows={entries} empty="No cost entries in this window." />
      <Pager {...entriesResult} searchParams={sp} basePath="/costs" />

      <h2 className="mb-2 mt-6 text-sm font-semibold">Driver advances</h2>
      <DataTable columns={advCols} rows={advances} />
    </>
  );
}
