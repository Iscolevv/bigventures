import { sql } from 'drizzle-orm';
import type { DB } from '../index';

export interface WeekCell {
  /** billed on approved trips (and one-off invoices tagged to the truck) that day */
  income: number;
  /** the status word typed for the day: "PKD JGRD", "GARAGED"... */
  note: string | null;
  /** a trip was logged that day but is not approved yet, so it has no income here */
  pending: boolean;
}

export interface WeekRow {
  vehicleId: string;
  registration: string;
  cells: WeekCell[];
  income: number;
  /** fuel on approved trips + costs recorded against the truck this week */
  expenses: number;
  /** income - expenses, the TOTAL column of the Excel sheet */
  total: number;
}

export interface WeekSheet {
  days: string[]; // 7 x YYYY-MM-DD, Monday first
  rows: WeekRow[];
  /** costs this week that were not for one truck (KRA, office...) - kept so totals reconcile */
  otherExpenses: number;
  totals: { income: number; expenses: number; total: number };
}

const addDays = (key: string, n: number) => {
  const d = new Date(`${key}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

/** Monday of the week containing this YYYY-MM-DD. */
export function mondayOf(key: string) {
  const d = new Date(`${key}T12:00:00Z`);
  const dow = (d.getUTCDay() + 6) % 7; // Mon=0 .. Sun=6
  return addDays(key, -dow);
}

/** Kevin's Excel week: a row per truck, a column per day, income (or a status word) in each cell. */
export async function weeklySheet(db: DB, weekStart: string): Promise<WeekSheet> {
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const end = days[6]!;
  const num = (x: unknown) => Number(x ?? 0);

  const [vehiclesRes, tripsRes, manualRes, fuelRes, costRes, notesRes] = await Promise.all([
    db.execute(sql`select id, registration from bigventures.vehicles order by registration`),
    db.execute(sql`
      select vehicle_id, (started_at + interval '3 hours')::date::text as day, status,
        coalesce(billed_amount, 0)::float8 as amt
      from bigventures.trips
      where (started_at + interval '3 hours')::date between ${weekStart}::date and ${end}::date
        and status in ('submitted', 'completed')`),
    db.execute(sql`
      select il.vehicle_id, inv.issue_date::text as day, il.line_total::float8 as amt
      from bigventures.invoice_lines il
      join bigventures.invoices inv on inv.id = il.invoice_id
      where il.trip_id is null and il.vehicle_id is not null
        and inv.status not in ('draft', 'void')
        and inv.issue_date between ${weekStart}::date and ${end}::date`),
    db.execute(sql`
      select fe.vehicle_id, sum(fe.total_cost)::float8 as amt
      from bigventures.fuel_entries fe
      where (fe.filled_at + interval '3 hours')::date between ${weekStart}::date and ${end}::date
        and (fe.trip_id is null or exists (
          select 1 from bigventures.trips tt where tt.id = fe.trip_id and tt.status <> 'submitted'))
      group by fe.vehicle_id`),
    db.execute(sql`
      select ce.vehicle_id, sum(ce.amount)::float8 as amt
      from bigventures.cost_entries ce
      where ce.incurred_at between ${weekStart}::date and ${end}::date
      group by ce.vehicle_id`),
    db.execute(sql`
      select vehicle_id, day::text as day, note
      from bigventures.vehicle_day_notes
      where day between ${weekStart}::date and ${end}::date`),
  ]);

  const rows: WeekRow[] = (vehiclesRes.rows as { id: string; registration: string }[]).map((v) => {
    const cells: WeekCell[] = days.map(() => ({ income: 0, note: null, pending: false }));
    for (const t of tripsRes.rows as { vehicle_id: string; day: string; status: string; amt: number }[]) {
      if (t.vehicle_id !== v.id) continue;
      const c = cells[days.indexOf(t.day)];
      if (!c) continue;
      if (t.status === 'submitted') c.pending = true;
      else c.income += num(t.amt);
    }
    for (const m of manualRes.rows as { vehicle_id: string; day: string; amt: number }[]) {
      if (m.vehicle_id !== v.id) continue;
      const c = cells[days.indexOf(m.day)];
      if (c) c.income += num(m.amt);
    }
    for (const n of notesRes.rows as { vehicle_id: string; day: string; note: string }[]) {
      if (n.vehicle_id !== v.id) continue;
      const c = cells[days.indexOf(n.day)];
      if (c) c.note = n.note;
    }
    const income = cells.reduce((s, c) => s + c.income, 0);
    const fuel = num((fuelRes.rows as { vehicle_id: string; amt: number }[]).find((f) => f.vehicle_id === v.id)?.amt);
    const cost = num((costRes.rows as { vehicle_id: string | null; amt: number }[]).find((c) => c.vehicle_id === v.id)?.amt);
    const expenses = fuel + cost;
    return { vehicleId: v.id, registration: v.registration, cells, income, expenses, total: income - expenses };
  });

  const otherExpenses = num((costRes.rows as { vehicle_id: string | null; amt: number }[]).find((c) => c.vehicle_id == null)?.amt);
  const income = rows.reduce((s, r) => s + r.income, 0);
  const expenses = rows.reduce((s, r) => s + r.expenses, 0) + otherExpenses;
  return { days, rows, otherExpenses, totals: { income, expenses, total: income - expenses } };
}

// ---- month and year-to-date views ------------------------------------

export interface RangeColumn {
  label: string;
  /** where clicking the heading should go: a week's columns drill to that week, a month's to that month */
  href: string;
}

export interface RangeRow {
  vehicleId: string;
  registration: string;
  cells: number[];
  income: number;
  expenses: number;
  total: number;
}

export interface RangeSheet {
  view: 'month' | 'year';
  title: string;
  from: string;
  to: string;
  columns: RangeColumn[];
  rows: RangeRow[];
  otherExpenses: number;
  columnTotals: number[];
  totals: { income: number; expenses: number; total: number };
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTHS_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/**
 * The same truck-by-period grid as the weekly sheet, zoomed out: a month shows a column per
 * week, a year (to date, if it is the current year) shows a column per month.
 * `anchor` is YYYY-MM for a month and YYYY for a year; `todayKey` caps the current year.
 */
export async function rangeSheet(db: DB, view: 'month' | 'year', anchor: string, todayKey: string): Promise<RangeSheet> {
  let from: string;
  let to: string;
  let title: string;
  const buckets: { from: string; to: string; label: string; href: string }[] = [];

  if (view === 'month') {
    const [y, m] = anchor.split('-').map(Number) as [number, number];
    from = `${anchor}-01`;
    to = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
    title = `${MONTHS_LONG[m - 1]} ${y}`;
    let start = from;
    while (start <= to) {
      const sunday = addDays(mondayOf(start), 6);
      const end = sunday < to ? sunday : to;
      const [, , d1] = start.split('-');
      const [, , d2] = end.split('-');
      buckets.push({ from: start, to: end, label: `${Number(d1)}-${Number(d2)} ${MONTHS[m - 1]}`, href: `/weekly?week=${start}` });
      start = addDays(end, 1);
    }
  } else {
    const y = Number(anchor);
    from = `${y}-01-01`;
    const isCurrent = todayKey.startsWith(String(y));
    to = isCurrent ? todayKey : `${y}-12-31`;
    const lastMonth = Number(to.slice(5, 7));
    title = isCurrent ? `${y} year to date` : String(y);
    for (let m = 1; m <= lastMonth; m++) {
      const mm = String(m).padStart(2, '0');
      const monthEnd = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
      buckets.push({ from: `${y}-${mm}-01`, to: monthEnd < to ? monthEnd : to, label: MONTHS[m - 1]!, href: `/weekly?view=month&month=${y}-${mm}` });
    }
  }

  const num = (x: unknown) => Number(x ?? 0);
  const [vehiclesRes, tripsRes, manualRes, fuelRes, costRes] = await Promise.all([
    db.execute(sql`select id, registration from bigventures.vehicles order by registration`),
    db.execute(sql`
      select vehicle_id, (started_at + interval '3 hours')::date::text as day, coalesce(billed_amount, 0)::float8 as amt
      from bigventures.trips
      where (started_at + interval '3 hours')::date between ${from}::date and ${to}::date and status = 'completed'`),
    db.execute(sql`
      select il.vehicle_id, inv.issue_date::text as day, il.line_total::float8 as amt
      from bigventures.invoice_lines il
      join bigventures.invoices inv on inv.id = il.invoice_id
      where il.trip_id is null and il.vehicle_id is not null and inv.status not in ('draft', 'void')
        and inv.issue_date between ${from}::date and ${to}::date`),
    db.execute(sql`
      select fe.vehicle_id, sum(fe.total_cost)::float8 as amt
      from bigventures.fuel_entries fe
      where (fe.filled_at + interval '3 hours')::date between ${from}::date and ${to}::date
        and (fe.trip_id is null or exists (select 1 from bigventures.trips tt where tt.id = fe.trip_id and tt.status <> 'submitted'))
      group by fe.vehicle_id`),
    db.execute(sql`
      select ce.vehicle_id, sum(ce.amount)::float8 as amt
      from bigventures.cost_entries ce
      where ce.incurred_at between ${from}::date and ${to}::date
      group by ce.vehicle_id`),
  ]);

  const bucketOf = (day: string) => buckets.findIndex((b) => day >= b.from && day <= b.to);
  const rows: RangeRow[] = (vehiclesRes.rows as { id: string; registration: string }[]).map((v) => {
    const cells = buckets.map(() => 0);
    for (const t of [...(tripsRes.rows as { vehicle_id: string; day: string; amt: number }[]), ...(manualRes.rows as { vehicle_id: string; day: string; amt: number }[])]) {
      if (t.vehicle_id !== v.id) continue;
      const i = bucketOf(t.day);
      if (i >= 0) cells[i] = (cells[i] ?? 0) + num(t.amt);
    }
    const income = cells.reduce((s, c) => s + c, 0);
    const fuel = num((fuelRes.rows as { vehicle_id: string; amt: number }[]).find((f) => f.vehicle_id === v.id)?.amt);
    const cost = num((costRes.rows as { vehicle_id: string | null; amt: number }[]).find((c) => c.vehicle_id === v.id)?.amt);
    return { vehicleId: v.id, registration: v.registration, cells, income, expenses: fuel + cost, total: income - fuel - cost };
  });

  const otherExpenses = num((costRes.rows as { vehicle_id: string | null; amt: number }[]).find((c) => c.vehicle_id == null)?.amt);
  const income = rows.reduce((s, r) => s + r.income, 0);
  const expenses = rows.reduce((s, r) => s + r.expenses, 0) + otherExpenses;
  return {
    view,
    title,
    from,
    to,
    columns: buckets.map((b) => ({ label: b.label, href: b.href })),
    rows,
    otherExpenses,
    columnTotals: buckets.map((_, i) => rows.reduce((s, r) => s + r.cells[i]!, 0)),
    totals: { income, expenses, total: income - expenses },
  };
}
