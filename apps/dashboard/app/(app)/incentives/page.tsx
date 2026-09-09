import { requirePermission, can } from '@/lib/session';
import { db } from '@bv/db';
import * as q from '@bv/db/queries';
import { periodKey } from '@bv/core/reference';
import { PageHeader, Card, DataTable, StatTile, Badge, kes, type Column } from '@/components/ui';
import { IncentiveRuleEditor } from '@/components/IncentiveRuleEditor';
import { GeneratePayrollButton, PayrollStatusButton } from '@/components/PayrollActions';
import { resolvePeriod } from '@/lib/period';

export const dynamic = 'force-dynamic';

export default async function IncentivesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const user = await requirePermission('payroll:read');
  const sp = await searchParams;
  const p = resolvePeriod(sp.period === '90d' || sp.period === 'all' ? 'month' : sp.period);
  const pkey = periodKey(p.from);

  const rule = await q.activeIncentiveRule(db);
  const [preview, runs] = await Promise.all([
    rule ? q.incentivePreview(db, p, rule.config) : Promise.resolve([]),
    q.payrollRunsForPeriod(db, pkey),
  ]);

  const totalIncentive = preview.reduce((s, r) => s + r.incentive.netIncentive, 0);
  const totalNet = preview.reduce((s, r) => s + r.payroll.netPay, 0);
  const canRun = can(user.role, 'payroll:approve');

  const previewCols: Column<(typeof preview)[number]>[] = [
    { key: 'd', header: 'Driver', render: (r) => <span className="font-medium">{r.driver}</span> },
    { key: 'trips', header: 'Trips', align: 'right', render: (r) => r.tripCount },
    {
      key: 'quality',
      header: 'Quality',
      align: 'right',
      render: (r) => (
        <Badge tone={r.qualityScore >= 0.9 ? 'ok' : r.qualityScore >= 0.75 ? 'warn' : 'crit'}>
          {(r.qualityScore * 100).toFixed(0)}
        </Badge>
      ),
    },
    { key: 'gross', header: 'Gross bonus', align: 'right', render: (r) => kes(r.incentive.grossIncentive) },
    { key: 'mult', header: '× quality', align: 'right', render: (r) => r.incentive.qualityMultiplier.toFixed(2) },
    {
      key: 'inc',
      header: 'Incentive',
      align: 'right',
      render: (r) => <span className="font-medium">{kes(r.incentive.netIncentive)}</span>,
    },
    { key: 'base', header: 'Base', align: 'right', render: (r) => kes(r.baseSalary) },
    { key: 'adv', header: 'Adv. ded.', align: 'right', render: (r) => kes(r.payroll.advanceDeduction) },
    { key: 'loss', header: 'Loss ded.', align: 'right', render: (r) => (r.payroll.lossDeduction ? kes(r.payroll.lossDeduction) : '—') },
    { key: 'net', header: 'Net pay', align: 'right', render: (r) => <span className="font-semibold text-ok">{kes(r.payroll.netPay)}</span> },
  ];

  const runCols: Column<(typeof runs)[number]>[] = [
    { key: 'd', header: 'Driver', render: (r) => r.driver },
    { key: 'trips', header: 'Trips', align: 'right', render: (r) => r.tripCount },
    { key: 'inc', header: 'Incentive', align: 'right', render: (r) => kes(r.incentive) },
    { key: 'adv', header: 'Adv. ded.', align: 'right', render: (r) => kes(r.advanceDeduction) },
    { key: 'net', header: 'Net pay', align: 'right', render: (r) => <span className="font-medium">{kes(r.netPay)}</span> },
    {
      key: 'status',
      header: 'Status',
      render: (r) => <Badge tone={r.status === 'paid' ? 'ok' : r.status === 'approved' ? 'brand' : 'muted'}>{r.status}</Badge>,
    },
    ...(canRun
      ? [
          {
            key: 'act',
            header: '',
            align: 'right' as const,
            render: (r: (typeof runs)[number]) => (
              <PayrollStatusButton runId={r.id} status={r.status as 'draft'} />
            ),
          },
        ]
      : []),
  ];

  return (
    <>
      <PageHeader
        title="Incentives & payroll"
        subtitle={`${p.label} · live preview`}
        actions={canRun && rule ? <GeneratePayrollButton period={p.key} /> : undefined}
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Drivers" value={preview.length} />
        <StatTile label="Incentive pool" value={kes(totalIncentive)} />
        <StatTile label="Total net pay" value={kes(totalNet)} />
        <StatTile label="Runs this period" value={runs.length} tone={runs.length ? 'ok' : 'default'} />
      </div>

      <Card title="Live incentive & payroll preview" className="mt-6">
        {rule ? (
          <DataTable columns={previewCols} rows={preview} />
        ) : (
          <p className="text-sm text-muted">No active incentive rule. Seed one with pnpm db:seed.</p>
        )}
      </Card>

      {runs.length > 0 && (
        <>
          <h2 className="mb-2 mt-6 text-sm font-semibold">Payroll run — {pkey}</h2>
          <DataTable columns={runCols} rows={runs} />
        </>
      )}

      {rule && (
        <Card title={`Incentive rule — ${rule.name}`} className="mt-6">
          <IncentiveRuleEditor
            ruleId={rule.id}
            config={rule.config}
            canEdit={can(user.role, 'incentive_rule:update')}
          />
        </Card>
      )}
    </>
  );
}
