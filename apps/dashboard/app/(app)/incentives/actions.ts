'use server';
import { revalidatePath } from 'next/cache';
import { requirePermission } from '@/lib/session';
import { writeAudit } from '@/lib/audit';
import { db, schema, eq } from '@bv/db';
import * as q from '@bv/db/queries';
import { incentiveRuleConfigSchema } from '@bv/core/calc';
import { periodKey } from '@bv/core/reference';
import { resolvePeriod } from '@/lib/period';

export async function saveIncentiveRule(ruleId: string, configJson: string) {
  const user = await requirePermission('incentive_rule:update');
  let parsed;
  try {
    parsed = incentiveRuleConfigSchema.parse(JSON.parse(configJson));
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Invalid config' };
  }
  const [before] = await db.select().from(schema.incentiveRules).where(eq(schema.incentiveRules.id, ruleId)).limit(1);
  await db
    .update(schema.incentiveRules)
    .set({ config: parsed, updated_at: new Date() })
    .where(eq(schema.incentiveRules.id, ruleId));
  await writeAudit(user, 'update', 'incentive_rule', ruleId, before?.config, parsed);
  revalidatePath('/incentives');
  return { ok: true };
}

export async function generatePayrollRun(period: string | undefined) {
  const user = await requirePermission('payroll:approve');
  const p = resolvePeriod(period === 'all' || period === '90d' ? 'month' : period);
  const pkey = periodKey(p.from);
  const rule = await q.activeIncentiveRule(db);
  if (!rule) return { error: 'No active incentive rule' };

  const preview = await q.incentivePreview(db, p, rule.config);
  let created = 0;
  for (const row of preview) {
    const existing = await db
      .select({ id: schema.payrollRuns.id, status: schema.payrollRuns.status })
      .from(schema.payrollRuns)
      .where(eq(schema.payrollRuns.driver_id, row.driverId))
      .limit(1);
    const hit = existing.find(() => true);
    const values = {
      driver_id: row.driverId,
      period_key: pkey,
      period_start: p.from.toISOString().slice(0, 10),
      period_end: new Date(p.to.getTime() - 86_400_000).toISOString().slice(0, 10),
      trip_count: row.tripCount,
      base_salary: String(row.baseSalary),
      incentive_amount: String(row.incentive.netIncentive),
      incentive_rule_id: rule.id,
      quality_score: String(row.qualityScore),
      advance_deduction: String(row.payroll.advanceDeduction),
      loss_deduction: String(row.payroll.lossDeduction),
      net_pay: String(row.payroll.netPay),
      breakdown: { incentive: row.incentive, payroll: row.payroll },
      status: 'draft' as const,
      updated_at: new Date(),
    };
    if (hit && hit.status !== 'paid') {
      await db.update(schema.payrollRuns).set(values).where(eq(schema.payrollRuns.id, hit.id));
    } else if (!hit) {
      await db.insert(schema.payrollRuns).values(values).onConflictDoNothing();
      created++;
    }
  }
  await writeAudit(user, 'create', 'payroll_run', pkey, null, { drivers: preview.length, created });
  revalidatePath('/incentives');
  return { ok: true, created };
}

export async function setPayrollStatus(runId: string, status: 'draft' | 'approved' | 'paid') {
  const user = await requirePermission('payroll:approve');
  await db
    .update(schema.payrollRuns)
    .set({
      status,
      approved_by: status === 'approved' ? user.id : undefined,
      approved_at: status === 'approved' ? new Date() : undefined,
      paid_at: status === 'paid' ? new Date() : undefined,
      updated_at: new Date(),
    })
    .where(eq(schema.payrollRuns.id, runId));
  await writeAudit(user, status === 'paid' ? 'update' : 'approve', 'payroll_run', runId, null, { status });
  revalidatePath('/incentives');
  return { ok: true };
}
