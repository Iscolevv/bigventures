/** Drizzle returns numeric(x,y) as string — coerce at the boundary. */
export const money = (v: string | number | null | undefined): number =>
  v == null ? 0 : typeof v === 'number' ? v : Number(v);

export const num = money;

export interface Period {
  from: Date;
  to: Date;
}

/** Calendar month containing `d`, as a Period [start, nextMonthStart). */
export function monthPeriod(d = new Date()): Period {
  const from = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
  const to = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1));
  return { from, to };
}

/** Last `n` days ending now. */
export function lastDays(n: number): Period {
  const to = new Date();
  const from = new Date(to.getTime() - n * 86_400_000);
  return { from, to };
}

export function monthsBetween(from: Date, to: Date): number {
  return Math.max(
    1,
    (to.getUTCFullYear() - from.getUTCFullYear()) * 12 +
      (to.getUTCMonth() - from.getUTCMonth()) +
      (to.getUTCDate() >= from.getUTCDate() ? 1 : 0),
  );
}
