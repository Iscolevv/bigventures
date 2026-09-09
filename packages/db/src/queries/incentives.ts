import { sql, eq, desc } from 'drizzle-orm';
import type { DB } from '../index';
import { drivers, payrollRuns, incentiveRules } from '../schema';
import { money, type Period } from './_util';
import { evaluateIncentive, runPayroll, qualityScore, type IncentiveResult, type PayrollResult } from '@bv/core/calc';

export async function activeIncentiveRule(db: DB) {
  const [r] = await db
    .select()
    .from(incentiveRules)
    .where(eq(incentiveRules.active, true))
    .orderBy(desc(incentiveRules.effective_from))
    .limit(1);
  return r ?? null;
}

export interface IncentivePreviewRow {
  driverId: string;
  driver: string;
  tripCount: number;
  qualityScore: number;
  incentive: IncentiveResult;
  payroll: PayrollResult;
  baseSalary: number;
  advanceBalance: number;
}

/** Live incentive + payroll preview for every driver over the period. */
export async function incentivePreview(
  db: DB,
  p: Period,
  ruleConfig: unknown,
): Promise<IncentivePreviewRow[]> {
  const from = p.from.toISOString();
  const to = p.to.toISOString();
  const result = await db.execute(sql`
    select
      d.id as driver_id, d.full_name as driver,
      d.base_salary, d.advance_balance, d.loss_balance,
      (select count(*)::int from bigventures.trips t where t.driver_id = d.id and t.started_at >= ${from} and t.started_at < ${to} and t.status in ('completed','flagged')) as trip_count,
      (select count(*)::int from bigventures.drops dr join bigventures.trips t on t.id = dr.trip_id where t.driver_id = d.id and t.started_at >= ${from} and t.started_at < ${to}) as total_drops,
      (select count(*)::int from bigventures.drops dr join bigventures.trips t on t.id = dr.trip_id where t.driver_id = d.id and t.started_at >= ${from} and t.started_at < ${to} and dr.geofence_entered_at is not null) as on_time_drops,
      (select count(*)::int from bigventures.drops dr join bigventures.trips t on t.id = dr.trip_id where t.driver_id = d.id and t.started_at >= ${from} and t.started_at < ${to} and dr.issue_category is null and dr.status = 'delivered') as clean_drops,
      (select count(*)::int from bigventures.trips t where t.driver_id = d.id and t.started_at >= ${from} and t.started_at < ${to} and t.status = 'completed') as delivered_trips,
      (select count(*)::int from bigventures.trips t where t.driver_id = d.id and t.started_at >= ${from} and t.started_at < ${to} and t.status = 'completed'
        and not exists (select 1 from bigventures.drops dr where dr.trip_id = t.id and dr.status = 'delivered'
          and not exists (select 1 from bigventures.pod_photos pp where pp.drop_id = dr.id))) as documented_trips,
      (select count(*)::int from bigventures.trips t where t.driver_id = d.id and t.started_at >= ${from} and t.started_at < ${to}) as checks_required,
      (select count(distinct vc.trip_id)::int from bigventures.vehicle_checks vc join bigventures.trips t on t.id = vc.trip_id where t.driver_id = d.id and t.started_at >= ${from} and t.started_at < ${to}) as checks_done
    from bigventures.drivers d
    order by d.full_name
  `);
  const rows = ((result.rows ?? result) as Record<string, unknown>[]).map((x) => ({
    driverId: x.driver_id as string,
    driver: x.driver as string,
    baseSalary: x.base_salary as string,
    advanceBalance: x.advance_balance as string,
    lossBalance: x.loss_balance as string,
    tripCount: Number(x.trip_count),
    totalDrops: Number(x.total_drops),
    onTimeDrops: Number(x.on_time_drops),
    cleanDrops: Number(x.clean_drops),
    deliveredTrips: Number(x.delivered_trips),
    documentedTrips: Number(x.documented_trips),
    checksRequired: Number(x.checks_required),
    checksDone: Number(x.checks_done),
  }));

  return rows.map((r) => {
    const q = qualityScore({
      onTimeDrops: r.onTimeDrops,
      totalDrops: r.totalDrops,
      cleanDrops: r.cleanDrops,
      checksCompleted: r.checksDone,
      checksRequired: r.checksRequired,
      fullyDocumentedTrips: r.documentedTrips,
      deliveredTrips: r.deliveredTrips,
      atFaultIncidents: money(r.lossBalance) > 0 ? 1 : 0,
    });
    const incentive = evaluateIncentive(ruleConfig, {
      tripCount: r.tripCount,
      qualityScore: q.composite,
    });
    const payroll = runPayroll({
      driverId: r.driverId,
      periodStart: p.from,
      periodEnd: p.to,
      baseSalary: money(r.baseSalary),
      incentive: incentive.netIncentive,
      openingAdvanceBalance: money(r.advanceBalance),
      advancesThisPeriod: 0,
      openingLossBalance: money(r.lossBalance),
      lossInstalment: money(r.lossBalance) > 0 ? 5000 : 0,
    });
    return {
      driverId: r.driverId,
      driver: r.driver,
      tripCount: r.tripCount,
      qualityScore: q.composite,
      incentive,
      payroll,
      baseSalary: money(r.baseSalary),
      advanceBalance: money(r.advanceBalance),
    };
  });
}

export async function payrollRunsForPeriod(db: DB, periodKey: string) {
  const rows = await db
    .select({
      id: payrollRuns.id,
      driver: drivers.full_name,
      tripCount: payrollRuns.trip_count,
      baseSalary: payrollRuns.base_salary,
      incentive: payrollRuns.incentive_amount,
      quality: payrollRuns.quality_score,
      advanceDeduction: payrollRuns.advance_deduction,
      lossDeduction: payrollRuns.loss_deduction,
      netPay: payrollRuns.net_pay,
      status: payrollRuns.status,
    })
    .from(payrollRuns)
    .leftJoin(drivers, eq(drivers.id, payrollRuns.driver_id))
    .where(eq(payrollRuns.period_key, periodKey))
    .orderBy(drivers.full_name);
  return rows.map((r) => ({
    ...r,
    baseSalary: money(r.baseSalary),
    incentive: money(r.incentive),
    quality: r.quality == null ? null : money(r.quality),
    advanceDeduction: money(r.advanceDeduction),
    lossDeduction: money(r.lossDeduction),
    netPay: money(r.netPay),
  }));
}
