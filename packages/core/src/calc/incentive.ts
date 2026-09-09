/**
 * Driver incentive engine.
 *
 * The rule config is stored as JSON on `incentive_rules.config` and is editable
 * by ops/management from the dashboard — no code change to retune tiers. This
 * module is the single evaluator both the dashboard preview and the payroll run
 * use, so "what the dashboard showed" always equals "what got paid".
 */

import { z } from 'zod';

export const incentiveTierSchema = z.object({
  /**
   * Exclusive lower threshold: trips beyond this running count are paid at this
   * tier's rate. `0` for the first tier.
   */
  minTrips: z.number().int().nonnegative(),
  /** inclusive upper bound of the running count; null = open-ended top tier */
  maxTrips: z.number().int().positive().nullable(),
  /** flat bonus paid per trip for trips that fall in this tier */
  perTripBonus: z.number().nonnegative(),
});
export type IncentiveTier = z.infer<typeof incentiveTierSchema>;

export const incentiveRuleConfigSchema = z.object({
  /** currency minor units? no — Big Ventures works in whole KES. */
  currency: z.literal('KES').default('KES'),
  /**
   * Marginal tiers. Trip N is paid at the rate of whichever tier its running
   * count falls in (like tax brackets), so crossing a boundary never reduces
   * take-home.
   */
  tiers: z.array(incentiveTierSchema).min(1),
  /**
   * Quality gate. Composite quality score (0..1) is multiplied into the bonus.
   * `floor` clamps how much a bad month can cut it; `applyBelow` means the
   * multiplier only bites when score < 1 (never a bonus above the tier rate).
   */
  quality: z
    .object({
      enabled: z.boolean().default(true),
      floor: z.number().min(0).max(1).default(0.5),
      /** score at/above which the driver gets the full bonus */
      fullCreditAt: z.number().min(0).max(1).default(0.95),
    })
    .default({ enabled: true, floor: 0.5, fullCreditAt: 0.95 }),
  /** hard minimum trips before ANY incentive is earned */
  qualifyingTrips: z.number().int().nonnegative().default(0),
  /** optional absolute cap on the incentive per period */
  periodCap: z.number().positive().nullable().default(null),
});
export type IncentiveRuleConfig = z.infer<typeof incentiveRuleConfigSchema>;

export interface IncentiveInput {
  tripCount: number;
  /** 0..1 composite; see calc/quality.ts */
  qualityScore: number;
}

export interface IncentiveBreakdownRow {
  tier: IncentiveTier;
  tripsInTier: number;
  gross: number;
}

export interface IncentiveResult {
  tripCount: number;
  qualified: boolean;
  grossIncentive: number;
  qualityMultiplier: number;
  netIncentive: number;
  capApplied: boolean;
  rows: IncentiveBreakdownRow[];
}

export function evaluateIncentive(
  rawConfig: unknown,
  input: IncentiveInput,
): IncentiveResult {
  const config = incentiveRuleConfigSchema.parse(rawConfig);
  const tiers = [...config.tiers].sort((a, b) => a.minTrips - b.minTrips);

  const qualified = input.tripCount >= config.qualifyingTrips;
  const rows: IncentiveBreakdownRow[] = [];
  let gross = 0;

  if (qualified) {
    for (const tier of tiers) {
      const lo = tier.minTrips; // exclusive threshold
      const hi = tier.maxTrips ?? Infinity; // inclusive
      const count = Math.max(0, Math.min(input.tripCount, hi) - lo);
      if (count > 0) {
        const rowGross = count * tier.perTripBonus;
        gross += rowGross;
        rows.push({ tier, tripsInTier: count, gross: rowGross });
      }
    }
  }

  const qualityMultiplier = config.quality.enabled
    ? qualityMultiplierFor(input.qualityScore, config.quality)
    : 1;

  let net = gross * qualityMultiplier;
  let capApplied = false;
  if (config.periodCap !== null && net > config.periodCap) {
    net = config.periodCap;
    capApplied = true;
  }

  return {
    tripCount: input.tripCount,
    qualified,
    grossIncentive: round2(gross),
    qualityMultiplier: round2(qualityMultiplier),
    netIncentive: round2(net),
    capApplied,
    rows,
  };
}

function qualityMultiplierFor(
  score: number,
  q: IncentiveRuleConfig['quality'],
): number {
  const clamped = Math.max(0, Math.min(1, score));
  if (clamped >= q.fullCreditAt) return 1;
  // linear ramp from floor (at score 0) to 1 (at fullCreditAt)
  const ramp = q.floor + (1 - q.floor) * (clamped / q.fullCreditAt);
  return Math.max(q.floor, Math.min(1, ramp));
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/** A sane starting config seeded on install; ops edits it from the dashboard. */
export const DEFAULT_INCENTIVE_CONFIG: IncentiveRuleConfig = incentiveRuleConfigSchema.parse({
  currency: 'KES',
  qualifyingTrips: 16,
  periodCap: null,
  tiers: [
    { minTrips: 0, maxTrips: 16, perTripBonus: 0 },
    { minTrips: 16, maxTrips: 24, perTripBonus: 200 },
    { minTrips: 24, maxTrips: 34, perTripBonus: 300 },
    { minTrips: 34, maxTrips: null, perTripBonus: 400 },
  ],
  quality: { enabled: true, floor: 0.6, fullCreditAt: 0.92 },
});
