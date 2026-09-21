import { requirePermission, can } from '@/lib/session';
import { db, schema, desc, eq } from '@bv/db';
import { COST_CATEGORIES, PAYMENT_METHODS } from '@bv/core/enums';
import { CostKindField } from '@/components/CostKindField';
import { addCost, deleteCost, addAdvance, deleteAdvance } from './actions';
import * as q from '@bv/db/queries';
import { PageHeader, Card, DataTable, StatTile, Badge, kes, dateShort, ExportLink, type Column } from '@/components/ui';
import { BarChartCard } from '@/components/Charts';
import { PeriodTabs } from '@/components/PeriodTabs';
import { Pager, pageParam } from '@/components/Pager';
import { resolvePeriod } from '@/lib/period';

export const dynamic = 'force-dynamic';
const fieldCls = 'mt-1 w-full rounded-md border bg-surface px-3 py-2 text-sm';

export default async function CostsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const user = await requirePermission('cost:read');
  const canAdd = can(user.role, 'cost:create');
  const sp = await searchParams;
  const today = new Date().toISOString().slice(0, 10);
  const [vehicleList, driverList, recentAdv] = await Promise.all([
    db.select({ id: schema.vehicles.id, reg: schema.vehicles.registration }).from(schema.vehicles).orderBy(schema.vehicles.registration),
    db.select({ id: schema.drivers.id, name: schema.drivers.full_name }).from(schema.drivers).orderBy(schema.drivers.full_name),
    db
      .select({ id: schema.advances.id, at: schema.advances.issued_at, dir: schema.advances.direction, amount: schema.advances.amount, note: schema.advances.description, driver: schema.drivers.full_name })
      .from(schema.advances)
      .innerJoin(schema.drivers, eq(schema.drivers.id, schema.advances.driver_id))
      .orderBy(desc(schema.advances.created_at))
      .limit(15),
  ]);
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
    { key: 'desc', header: 'Description', render: (r) => r.description ?? '-' },
    { key: 'veh', header: 'Vehicle', render: (r) => <span className="text-muted">{r.vehicle ?? '-'}</span> },
    { key: 'amt', header: 'Amount', align: 'right', render: (r) => kes(r.amount) },
    {
      key: 'status',
      header: 'Status',
      render: (r) => <Badge tone={r.status === 'approved' ? 'ok' : r.status === 'rejected' ? 'crit' : 'warn'}>{r.status}</Badge>,
    },
    ...(can(user.role, 'cost:delete')
      ? [
          {
            key: 'del',
            header: '',
            align: 'right' as const,
            render: (r: (typeof entries)[number]) => (
              <form action={deleteCost}>
                <input type="hidden" name="id" value={r.id} />
                <button className="text-xs text-crit hover:underline">Remove</button>
              </form>
            ),
          },
        ]
      : []),
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
    { key: 'loss', header: 'Loss bal.', align: 'right', render: (r) => (r.lossBalance > 0 ? <span className="text-crit">{kes(r.lossBalance)}</span> : '-') },
    { key: 'last', header: 'Last activity', render: (r) => <span className="text-muted">{dateShort(r.lastActivity)}</span> },
  ];

  return (
    <>
      <PageHeader title="Costs & advances" subtitle={p.label} actions={<div className="flex gap-2"><ExportLink type="costs" /><PeriodTabs current={p.key} /></div>} />

      {sp.msg && <p className="mb-3 rounded-lg border border-ok/40 bg-ok/10 px-3 py-2 text-sm text-ok">{sp.msg}</p>}
      {sp.error && <p className="mb-3 rounded-lg border border-crit/40 bg-crit/10 px-3 py-2 text-sm text-crit">{sp.error}</p>}

      {canAdd && (
        <div className="mb-6 grid gap-4 lg:grid-cols-2">
          <Card title="Record a cost">
            <form action={addCost} className="grid gap-3 sm:grid-cols-2">
              <CostKindField categories={COST_CATEGORIES} />
              <label className="text-sm font-medium">
                Amount (Ksh)
                <input name="amount" inputMode="decimal" required className={fieldCls} />
              </label>
              <label className="text-sm font-medium">
                Vehicle
                <select name="vehicleId" defaultValue="" className={fieldCls}>
                  <option value="">Not for one vehicle</option>
                  {vehicleList.map((v) => (
                    <option key={v.id} value={v.id}>{v.reg}</option>
                  ))}
                </select>
              </label>
              <label className="text-sm font-medium">
                Date
                <input name="date" type="date" defaultValue={today} className={fieldCls} />
              </label>
              <label className="text-sm font-medium">
                Driver (if it was theirs)
                <select name="driverId" defaultValue="" className={fieldCls}>
                  <option value="">None</option>
                  {driverList.map((d) => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              </label>
              <label className="text-sm font-medium">
                Paid to (optional)
                <input name="vendor" className={fieldCls} placeholder="garage, police, KRA..." />
              </label>
              <label className="text-sm font-medium sm:col-span-2">
                Note (optional)
                <input name="description" className={fieldCls} placeholder="e.g. rear tyre replaced" />
              </label>
              <div className="sm:col-span-2">
                <button className="rounded-md bg-brand px-4 py-2 text-sm font-semibold text-white">Save cost</button>
              </div>
            </form>
          </Card>

          <Card title="Advance, repayment or write-off for a driver">
            <form action={addAdvance} className="grid gap-3 sm:grid-cols-2">
              <label className="text-sm font-medium">
                Driver
                <select name="driverId" required defaultValue="" className={fieldCls}>
                  <option value="" disabled>Pick a driver…</option>
                  {driverList.map((d) => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              </label>
              <label className="text-sm font-medium">
                What happened
                <select name="direction" defaultValue="disbursed" className={fieldCls}>
                  <option value="disbursed">Advance given</option>
                  <option value="repaid">Repaid / deducted</option>
                  <option value="written_off">Written off</option>
                </select>
              </label>
              <label className="text-sm font-medium">
                Amount (Ksh)
                <input name="amount" inputMode="decimal" required className={fieldCls} />
              </label>
              <label className="text-sm font-medium">
                Date
                <input name="date" type="date" defaultValue={today} className={fieldCls} />
              </label>
              <label className="text-sm font-medium">
                How paid
                <select name="method" defaultValue="mpesa" className={`${fieldCls} capitalize`}>
                  {PAYMENT_METHODS.map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </label>
              <label className="text-sm font-medium">
                Note (optional)
                <input name="description" className={fieldCls} placeholder="e.g. police Mwingi" />
              </label>
              <div className="sm:col-span-2">
                <button className="rounded-md bg-brand px-4 py-2 text-sm font-semibold text-white">Save</button>
              </div>
            </form>
          </Card>
        </div>
      )}

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

      {recentAdv.length > 0 && (
        <>
          <h2 className="mb-2 mt-6 text-sm font-semibold">Latest advance entries</h2>
          <Card className="p-0">
            <ul className="divide-y text-sm">
              {recentAdv.map((a) => (
                <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5">
                  <span>
                    <span className="font-medium">{a.driver}</span>
                    <span className="ml-2 text-muted">
                      {a.dir === 'disbursed' ? 'advance given' : a.dir === 'repaid' ? 'repaid' : 'written off'} · {dateShort(a.at)}
                      {a.note ? ` · ${a.note}` : ''}
                    </span>
                  </span>
                  <span className="flex items-center gap-3">
                    <span className="tabular-nums">{kes(Number(a.amount))}</span>
                    {can(user.role, 'advance:delete') && (
                      <form action={deleteAdvance}>
                        <input type="hidden" name="id" value={a.id} />
                        <button className="text-xs text-crit hover:underline">Remove</button>
                      </form>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        </>
      )}
    </>
  );
}
