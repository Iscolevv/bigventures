/**
 * Fuel consumption + anomaly detection.
 *
 * The dashboard "Fuel and consumption" view calls `vehicleConsumption()` per
 * trip and `rollingBaseline()` over history, then `isConsumptionAnomaly()` to
 * decide whether to raise a `fuel_anomaly` alert.
 */

export interface FuelFill {
  litres: number;
  totalCost: number;
  odometerKm: number;
  filledAt: Date;
}

export interface ConsumptionResult {
  distanceKm: number;
  litres: number;
  litresPer100Km: number | null;
  kmPerLitre: number | null;
  costPerKm: number | null;
}

/**
 * Consumption for a window of fills, using the standard "full-to-full" method:
 * distance between the first and last fill, litres = everything added AFTER the
 * first fill (the first fill just establishes the starting full tank).
 */
export function consumptionFromFills(fills: readonly FuelFill[]): ConsumptionResult | null {
  if (fills.length < 2) return null;
  const sorted = [...fills].sort((a, b) => a.odometerKm - b.odometerKm);
  const first = sorted[0]!;
  const last = sorted[sorted.length - 1]!;
  const distanceKm = last.odometerKm - first.odometerKm;
  if (distanceKm <= 0) return null;

  const litres = sorted.slice(1).reduce((s, f) => s + f.litres, 0);
  const cost = sorted.slice(1).reduce((s, f) => s + f.totalCost, 0);
  if (litres <= 0) return null;

  return {
    distanceKm,
    litres,
    litresPer100Km: (litres / distanceKm) * 100,
    kmPerLitre: distanceKm / litres,
    costPerKm: cost / distanceKm,
  };
}

/** Trip-level consumption when you know the trip distance and litres burned. */
export function tripConsumption(distanceKm: number, litres: number, cost: number): ConsumptionResult | null {
  if (distanceKm <= 0 || litres <= 0) return null;
  return {
    distanceKm,
    litres,
    litresPer100Km: (litres / distanceKm) * 100,
    kmPerLitre: distanceKm / litres,
    costPerKm: cost / distanceKm,
  };
}

export interface Baseline {
  mean: number;
  stdDev: number;
  sampleSize: number;
}

/** Mean + population std-dev of a metric series (e.g. litres/100km per trip). */
export function baseline(series: readonly number[]): Baseline | null {
  const xs = series.filter((n) => Number.isFinite(n) && n > 0);
  if (xs.length < 3) return null;
  const mean = xs.reduce((s, n) => s + n, 0) / xs.length;
  const variance = xs.reduce((s, n) => s + (n - mean) ** 2, 0) / xs.length;
  return { mean, stdDev: Math.sqrt(variance), sampleSize: xs.length };
}

export interface AnomalyVerdict {
  isAnomaly: boolean;
  zScore: number | null;
  pctOverMean: number | null;
  reason: string | null;
}

/**
 * Flag a trip's consumption as anomalous if it is both:
 *   - more than `pctThreshold` above the vehicle's historical mean, AND
 *   - more than `zThreshold` standard deviations out (when we have a std-dev).
 * The AND keeps low-variance vehicles from tripping on small absolute wobble.
 */
export function isConsumptionAnomaly(
  observed: number,
  vehicleBaseline: Baseline | null,
  opts: { pctThreshold?: number; zThreshold?: number } = {},
): AnomalyVerdict {
  const pctThreshold = opts.pctThreshold ?? 0.2; // 20% over mean
  const zThreshold = opts.zThreshold ?? 2;
  if (!vehicleBaseline) {
    return { isAnomaly: false, zScore: null, pctOverMean: null, reason: 'insufficient history' };
  }
  const pctOverMean = (observed - vehicleBaseline.mean) / vehicleBaseline.mean;
  const zScore =
    vehicleBaseline.stdDev > 0 ? (observed - vehicleBaseline.mean) / vehicleBaseline.stdDev : null;

  const overPct = pctOverMean > pctThreshold;
  const overZ = zScore === null ? overPct : zScore > zThreshold;
  const isAnomaly = overPct && overZ;

  return {
    isAnomaly,
    zScore,
    pctOverMean,
    reason: isAnomaly
      ? `${Math.round(pctOverMean * 100)}% above this vehicle's average` +
        (zScore !== null ? ` (${zScore.toFixed(1)}σ)` : '')
      : null,
  };
}
