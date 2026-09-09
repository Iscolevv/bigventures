import { sql, eq, and, gte, lt, desc } from 'drizzle-orm';
import type { DB } from '../index';
import { drivers, trips, drops, podPhotos, vehicleChecks, qualitySnapshots, payrollRuns, incentiveRules } from '../schema';
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
  const rows = await db
    .select({
      driverId: drivers.id,
      driver: drivers.full_name,
      baseSalary: drivers.base_salary,
      advanceBalance: drivers.advance_balance,
      lossBalance: drivers.loss_balance,
      tripCount: sql<number>`(select count(*)::int from ${trips} where ${trips.driver_id} = ${drivers.id} and ${trips.started_at} >= ${p.from} and ${trips.started_at} < ${p.to} and ${trips.status} in ('completed','flagged'))`,
      totalDrops: sql<number>`(select count(*)::int from ${drops} d join ${trips} t on t.id = d.trip_id where t.driver_id = ${drivers.id} and t.started_at >= ${p.from} and t.started_at < ${p.to})`,
      onTimeDrops: sql<number>`(select count(*)::int from ${drops} d join ${trips} t on t.id = d.trip_id where t.driver_id = ${drivers.id} and t.started_at >= ${p.from} and t.started_at < ${p.to} and d.geofence_entered_at is not null)`,
      cleanDrops: sql<number>`(select count(*)::int from ${drops} d join ${trips} t on t.id = d.trip_id where t.driver_id = ${drivers.id} and t.started_at >= ${p.from} and t.started_at < ${p.to} and d.issue_category is null and d.status = 'delivered')`,
      deliveredTrips: sql<number>`(select count(*)::int from ${trips} where ${trips.driver_id} = ${drivers.id} and ${trips.started_at} >= ${p.from} and ${trips.started_at} < ${p.to} and ${trips.status} = 'completed')`,
      documentedTrips: sql<number>`(select count(*)::int from ${trips} t where t.driver_id = ${drivers.id} and t.started_at >= ${p.from} and t.started_at < ${p.to} and t.status = 'completed' and not exists (select 1 from ${drops} d where d.trip_id = t.id and d.status = 'delivered' and not exists (select 1 from ${podPhotos} pp where pp.drop_id = d.id)))`,
      checksRequired: sql<number>`(select count(*)::int from ${trips} where ${trips.driver_id} = ${drivers.id} and ${trips.started_at} >= ${p.from} and ${trips.started_at} < ${p.to})`,
      checksDone: sql<number>`(select count(distinct ${vehicleChecks.trip_id})::int from ${vehicleChecks} join ${trips} t on t.id = ${vehicleChecks.trip_id} where t.driver_id = ${drivers.id} and t.started_at >= ${p.from} and t.started_at < ${p.to})`,
    })
    .from(drivers)
    .orderBy(drivers.full_name);

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
