import { test } from 'node:test';
import assert from 'node:assert/strict';
import { evaluateIncentive, DEFAULT_INCENTIVE_CONFIG } from './incentive';
import { runPayroll, advanceBalance } from './payroll';
import { baseline, isConsumptionAnomaly, tripConsumption } from './fuel';
import { qualityScore } from './quality';
import { vehicleRoi, routeCostSummary } from './roi';

test('incentive: below qualifying trips earns nothing', () => {
  const r = evaluateIncentive(DEFAULT_INCENTIVE_CONFIG, { tripCount: 10, qualityScore: 1 });
  assert.equal(r.qualified, false);
  assert.equal(r.netIncentive, 0);
});

test('incentive: marginal tiers stack like tax brackets', () => {
  // default: 0-16 @0, 16-24 @200, 24-34 @300, 34+ @400
  // 30 trips: 8*200 (1600) + 6*300 (1800) = 3400
  const r = evaluateIncentive(DEFAULT_INCENTIVE_CONFIG, { tripCount: 30, qualityScore: 1 });
  assert.equal(r.qualified, true);
  assert.equal(r.grossIncentive, 3400);
  assert.equal(r.netIncentive, 3400);
});

test('incentive: a big month spans every tier', () => {
  // 50 trips: 8*200 (1600) + 10*300 (3000) + 16*400 (6400) = 11000
  const r = evaluateIncentive(DEFAULT_INCENTIVE_CONFIG, { tripCount: 50, qualityScore: 1 });
  assert.equal(r.grossIncentive, 11000);
});

test('incentive: poor quality applies the multiplier, never below floor', () => {
  const r = evaluateIncentive(DEFAULT_INCENTIVE_CONFIG, { tripCount: 50, qualityScore: 0 });
  assert.equal(r.qualityMultiplier, 0.6);
  assert.equal(r.netIncentive, 6600);
});

test('incentive: period cap clamps net', () => {
  const cfg = { ...DEFAULT_INCENTIVE_CONFIG, periodCap: 5000 };
  const r = evaluateIncentive(cfg, { tripCount: 100, qualityScore: 1 });
  assert.equal(r.netIncentive, 5000);
  assert.equal(r.capApplied, true);
});

test('advanceBalance nets disbursed against repaid', () => {
  assert.equal(
    advanceBalance([
      { amount: 10000, direction: 'disbursed' },
      { amount: 3000, direction: 'repaid' },
      { amount: 2000, direction: 'disbursed' },
    ]),
    9000,
  );
});

test('payroll: advance recovery respects the take-home floor', () => {
  const r = runPayroll({
    driverId: 'd1',
    periodStart: new Date('2026-01-01'),
    periodEnd: new Date('2026-01-31'),
    baseSalary: 25000,
    incentive: 5000,
    openingAdvanceBalance: 40000,
    advancesThisPeriod: 0,
    openingLossBalance: 0,
    lossInstalment: 0,
    minTakeHomeFraction: 0.4,
  });
  // gross 30000, floor 12000, so at most 18000 advance recovered this period
  assert.equal(r.advanceDeduction, 18000);
  assert.equal(r.netPay, 12000);
  assert.equal(r.closingAdvanceBalance, 22000);
});

test('payroll: loss instalment takes priority over advance', () => {
  const r = runPayroll({
    driverId: 'd1',
    periodStart: new Date('2026-02-01'),
    periodEnd: new Date('2026-02-28'),
    baseSalary: 23000,
    incentive: 0,
    openingAdvanceBalance: 10000,
    advancesThisPeriod: 0,
    openingLossBalance: 15594.92,
    lossInstalment: 5000,
    minTakeHomeFraction: 0.4,
  });
  assert.equal(r.lossDeduction, 5000);
  assert.equal(r.closingLossBalance, 10594.92);
});

test('fuel: anomaly needs both % and sigma to trip', () => {
  const series = [28, 29, 30, 28.5, 31, 27.5, 29.5];
  const b = baseline(series);
  assert.ok(b);
  const normal = isConsumptionAnomaly(31, b);
  assert.equal(normal.isAnomaly, false);
  const spike = isConsumptionAnomaly(45, b);
  assert.equal(spike.isAnomaly, true);
});

test('fuel: trip consumption maths', () => {
  const c = tripConsumption(300, 90, 13500);
  assert.ok(c);
  assert.equal(c.litresPer100Km, 30);
  assert.equal(c.kmPerLitre, 300 / 90);
  assert.equal(c.costPerKm, 45);
});

test('quality: at-fault incident penalises composite', () => {
  const clean = qualityScore({
    onTimeDrops: 100, totalDrops: 100, cleanDrops: 100,
    checksCompleted: 20, checksRequired: 20,
    fullyDocumentedTrips: 20, deliveredTrips: 20, atFaultIncidents: 0,
  });
  assert.equal(clean.composite, 1);
  const withIncident = qualityScore({
    onTimeDrops: 100, totalDrops: 100, cleanDrops: 100,
    checksCompleted: 20, checksRequired: 20,
    fullyDocumentedTrips: 20, deliveredTrips: 20, atFaultIncidents: 1,
  });
  assert.equal(withIncident.composite, 0.85);
});

test('roi: vehicle net contribution subtracts overhead', () => {
  const r = vehicleRoi({
    vehicleId: 'KDJ483Z',
    revenue: 500000,
    fuelCost: 120000,
    runningCost: 80000,
    allocatedOverhead: 17000,
    distanceKm: 4000,
    tripCount: 8,
  });
  assert.equal(r.grossProfit, 300000);
  assert.equal(r.netContribution, 283000);
});

test('roi: route cost summary produces stats', () => {
  const s = routeCostSummary([
    { fuelCost: 8000, distanceKm: 210, durationMin: 300, revenue: 20000 },
    { fuelCost: 9000, distanceKm: 220, durationMin: 330, revenue: 20000 },
    { fuelCost: 8500, distanceKm: 215, durationMin: 315, revenue: 20000 },
  ]);
  assert.ok(s);
  assert.equal(s.trips, 3);
  assert.equal(s.fuelCost.min, 8000);
  assert.equal(s.fuelCost.max, 9000);
});
