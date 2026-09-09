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

// ---- pagination ----------------------------------------------------

export interface PageArgs {
  page?: number;
  pageSize?: number;
}

export interface Paged<T> {
  rows: T[];
  total: number;
  page: number;
  pageSize: number;
  pages: number;
}

export function pageBounds({ page = 1, pageSize = 25 }: PageArgs) {
  const p = Math.max(1, Math.floor(page));
  const size = Math.min(200, Math.max(5, Math.floor(pageSize)));
  return { limit: size, offset: (p - 1) * size, page: p, pageSize: size };
}

export function paged<T>(rows: T[], total: number, page: number, pageSize: number): Paged<T> {
  return { rows, total, page, pageSize, pages: Math.max(1, Math.ceil(total / pageSize)) };
}

export function monthsBetween(from: Date, to: Date): number {
  return Math.max(
    1,
    (to.getUTCFullYear() - from.getUTCFullYear()) * 12 +
      (to.getUTCMonth() - from.getUTCMonth()) +
      (to.getUTCDate() >= from.getUTCDate() ? 1 : 0),
  );
}
