/**
 * ROI / contribution analysis, per vehicle and per driver, over a period.
 *
 * The dashboard passes already-aggregated totals (summed in SQL) into these
 * functions; the functions own the arithmetic and the definition of "profit"
 * so every view agrees.
 */

export interface PeriodRange {
  from: Date;
  to: Date;
}

export interface VehicleRoiInput {
  vehicleId: string;
  /** revenue attributed to this vehicle's delivered trips in the period */
  revenue: number;
  fuelCost: number;
  /** repairs + service + tires + parking + fines etc. from cost_entries */
  runningCost: number;
  /** monthly finance / SACCO contribution × months in the period */
  allocatedOverhead: number;
  distanceKm: number;
  tripCount: number;
}

export interface VehicleRoiResult {
  vehicleId: string;
  revenue: number;
  totalCost: number;
  grossProfit: number; // revenue - fuel - running
  netContribution: number; // grossProfit - allocatedOverhead
  marginPct: number | null;
  costPerKm: number | null;
  revenuePerKm: number | null;
  profitPerTrip: number | null;
}

export function vehicleRoi(i: VehicleRoiInput): VehicleRoiResult {
  const totalCost = i.fuelCost + i.runningCost + i.allocatedOverhead;
  const grossProfit = i.revenue - i.fuelCost - i.runningCost;
  const netContribution = grossProfit - i.allocatedOverhead;
  return {
    vehicleId: i.vehicleId,
    revenue: r2(i.revenue),
    totalCost: r2(totalCost),
    grossProfit: r2(grossProfit),
    netContribution: r2(netContribution),
    marginPct: i.revenue > 0 ? r2((netContribution / i.revenue) * 100) : null,
    costPerKm: i.distanceKm > 0 ? r2(totalCost / i.distanceKm) : null,
    revenuePerKm: i.distanceKm > 0 ? r2(i.revenue / i.distanceKm) : null,
    profitPerTrip: i.tripCount > 0 ? r2(netContribution / i.tripCount) : null,
  };
}

export interface DriverRoiInput {
  driverId: string;
  revenue: number; // revenue on trips this driver ran
  fuelCost: number;
  runningCost: number; // costs attributable to the driver
  wageCost: number; // base salary portion + incentive for the period
  tripCount: number;
  distanceKm: number;
}

export interface DriverRoiResult {
  driverId: string;
  revenue: number;
  totalCost: number;
  netContribution: number;
  contributionPerTrip: number | null;
  revenuePerKm: number | null;
}

export function driverRoi(i: DriverRoiInput): DriverRoiResult {
  const totalCost = i.fuelCost + i.runningCost + i.wageCost;
  const netContribution = i.revenue - totalCost;
  return {
    driverId: i.driverId,
    revenue: r2(i.revenue),
    totalCost: r2(totalCost),
    netContribution: r2(netContribution),
    contributionPerTrip: i.tripCount > 0 ? r2(netContribution / i.tripCount) : null,
    revenuePerKm: i.distanceKm > 0 ? r2(i.revenue / i.distanceKm) : null,
  };
}

/**
 * Route-cost analytics roll-up: given every historical trip on one routeKey,
 * summarise fuel cost / distance / duration so ops can quote and compare.
 */
export interface RouteTripSample {
  fuelCost: number;
  distanceKm: number;
  durationMin: number;
  revenue: number | null;
}

export interface RouteCostSummary {
  trips: number;
  fuelCost: Stats;
  distanceKm: Stats;
  durationMin: Stats;
  marginPct: number | null;
}

export interface Stats {
  min: number;
  max: number;
  mean: number;
  median: number;
  p90: number;
}

export function routeCostSummary(samples: readonly RouteTripSample[]): RouteCostSummary | null {
  if (samples.length === 0) return null;
  const fuel = stats(samples.map((s) => s.fuelCost));
  const dist = stats(samples.map((s) => s.distanceKm));
  const dur = stats(samples.map((s) => s.durationMin));

  const withRev = samples.filter((s) => s.revenue != null) as Array<
    RouteTripSample & { revenue: number }
  >;
  let marginPct: number | null = null;
  if (withRev.length > 0) {
    const rev = withRev.reduce((s, x) => s + x.revenue, 0);
    const cost = withRev.reduce((s, x) => s + x.fuelCost, 0);
    marginPct = rev > 0 ? r2(((rev - cost) / rev) * 100) : null;
  }

  return { trips: samples.length, fuelCost: fuel, distanceKm: dist, durationMin: dur, marginPct };
}

export function stats(xs: readonly number[]): Stats {
  const s = [...xs].filter((n) => Number.isFinite(n)).sort((a, b) => a - b);
  const n = s.length;
  const q = (p: number) => {
    if (n === 0) return 0;
    const idx = (n - 1) * p;
    const lo = Math.floor(idx);
    const hi = Math.ceil(idx);
    return s[lo]! + (s[hi]! - s[lo]!) * (idx - lo);
  };
  return {
    min: n ? s[0]! : 0,
    max: n ? s[n - 1]! : 0,
    mean: n ? r2(s.reduce((a, b) => a + b, 0) / n) : 0,
    median: r2(q(0.5)),
    p90: r2(q(0.9)),
  };
}

const r2 = (n: number) => Math.round(n * 100) / 100;
