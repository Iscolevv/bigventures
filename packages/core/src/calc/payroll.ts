/**
 * Period payroll netting for a driver:
 *
 *   net = base salary
 *       + incentive (from calc/incentive.ts)
 *       - advance deductions (capped so take-home never goes below a floor)
 *       - loss deductions   (at-fault losses, spread over agreed instalments)
 *
 * Anything not fully recovered this period rolls forward as the new balance.
 */

export interface AdvanceLedgerEntry {
  amount: number;
  direction: 'disbursed' | 'repaid' | 'written_off';
}

/** Net outstanding advance for a driver from their full ledger. */
export function advanceBalance(entries: readonly AdvanceLedgerEntry[]): number {
  return round2(
    entries.reduce((bal, e) => {
      if (e.direction === 'disbursed') return bal + e.amount;
      return bal - e.amount; // repaid or written_off both reduce what's owed
    }, 0),
  );
}

export interface PayrollInput {
  driverId: string;
  periodStart: Date;
  periodEnd: Date;
  baseSalary: number;
  incentive: number;
  /** advance owed at the start of the period */
  openingAdvanceBalance: number;
  /** advances taken during the period */
  advancesThisPeriod: number;
  /** confirmed at-fault loss still to be recovered */
  openingLossBalance: number;
  /** portion of loss balance scheduled for recovery this period */
  lossInstalment: number;
  /**
   * Take-home may not drop below this fraction of (base + incentive) even if
   * that means recovering less advance this period. Protects the driver from a
   * zero-pay month; the shortfall rolls forward.
   */
  minTakeHomeFraction?: number;
}

export interface PayrollResult {
  driverId: string;
  gross: number; // base + incentive
  advanceDeduction: number;
  lossDeduction: number;
  netPay: number;
  closingAdvanceBalance: number;
  closingLossBalance: number;
  deferredRecovery: number; // advance we wanted to take but couldn't this period
}

export function runPayroll(i: PayrollInput): PayrollResult {
  const minFraction = i.minTakeHomeFraction ?? 0.4;
  const gross = round2(i.baseSalary + i.incentive);
  const minTakeHome = round2(gross * minFraction);

  const recoverableAdvance = round2(i.openingAdvanceBalance + i.advancesThisPeriod);

  // Loss instalment takes priority, then advance, then respect the floor.
  const lossDeduction = round2(Math.min(i.lossInstalment, i.openingLossBalance, gross));
  const afterLoss = round2(gross - lossDeduction);

  const maxAdvanceByFloor = round2(Math.max(0, afterLoss - minTakeHome));
  const advanceDeduction = round2(Math.min(recoverableAdvance, maxAdvanceByFloor));

  const netPay = round2(afterLoss - advanceDeduction);
  const closingAdvanceBalance = round2(recoverableAdvance - advanceDeduction);
  const closingLossBalance = round2(i.openingLossBalance - lossDeduction);
  const deferredRecovery = round2(
    Math.max(0, Math.min(recoverableAdvance, afterLoss) - advanceDeduction),
  );

  return {
    driverId: i.driverId,
    gross,
    advanceDeduction,
    lossDeduction,
    netPay,
    closingAdvanceBalance,
    closingLossBalance,
    deferredRecovery,
  };
}

const round2 = (n: number) => Math.round(n * 100) / 100;
