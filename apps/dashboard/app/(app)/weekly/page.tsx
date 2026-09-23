import Link from 'next/link';
import { requirePermission, can } from '@/lib/session';
import { db } from '@bv/db';
import * as q from '@bv/db/queries';
import { PageHeader } from '@/components/ui';
import { WeekCell } from '@/components/WeekCell';

export const dynamic = 'force-dynamic';

const nairobiToday = () => new Date(Date.now() + 3 * 3600_000).toISOString().slice(0, 10);
const shift = (key: string, days: number) => {
  const d = new Date(`${key}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};
const shiftMonth = (ym: string, n: number) => {
  const [y, m] = ym.split('-').map(Number) as [number, number];
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
};
const dayLabel = (key: string) => {
  const [y, m, d] = key.split('-');
  return `${d}/${m}/${y}`;
};
const weekday = (key: string) => new Date(`${key}T12:00:00Z`).toLocaleDateString('en-KE', { weekday: 'short', timeZone: 'UTC' });
const money = (n: number) => n.toLocaleString('en-KE', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
/** the Excel way: negatives in brackets */
const bracket = (n: number) => (n < 0 ? `(${money(Math.abs(n))})` : money(n));

const btn = 'rounded-md border px-3 py-1.5 text-sm hover:bg-bg';

export default async function IncomeSheetPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; week?: string; month?: string; year?: string }>;
}) {
  const user = await requirePermission('trip:read');
  const sp = await searchParams;
  const today = nairobiToday();
  const view = sp.view === 'month' || sp.view === 'year' ? sp.view : 'week';

  const weekPick = /^\d{4}-\d{2}-\d{2}$/.test(sp.week ?? '') ? sp.week! : today;
  const weekStart = q.mondayOf(weekPick);
  const month = /^\d{4}-\d{2}$/.test(sp.month ?? '') ? sp.month! : today.slice(0, 7);
  const year = /^\d{4}$/.test(sp.year ?? '') ? sp.year! : today.slice(0, 4);

  // where the other tabs should land, given what is on screen now
  const anchorMonth = view === 'week' ? weekStart.slice(0, 7) : view === 'month' ? month : year === today.slice(0, 4) ? today.slice(0, 7) : `${year}-01`;
  const anchorYear = view === 'week' ? weekStart.slice(0, 4) : view === 'month' ? month.slice(0, 4) : year;
  const weekTab = view === 'week' ? `/weekly?week=${weekStart}` : view === 'month' ? `/weekly?week=${month === today.slice(0, 7) ? today : `${month}-01`}` : '/weekly';
  const tabs = [
    { key: 'week', label: 'Week', href: weekTab },
    { key: 'month', label: 'Month', href: `/weekly?view=month&month=${anchorMonth}` },
    { key: 'year', label: 'Year to date', href: `/weekly?view=year&year=${anchorYear}` },
  ];

  const tabBar = (
    <div className="flex rounded-lg border bg-surface p-0.5 text-sm">
      {tabs.map((t) => (
        <Link key={t.key} href={t.href} className={`rounded-md px-3 py-1.5 ${view === t.key ? 'bg-brand font-semibold text-white' : 'hover:bg-bg'}`}>
          {t.label}
        </Link>
      ))}
    </div>
  );

  // ---------------------------------------------------------------- week
  if (view === 'week') {
    const sheet = await q.weeklySheet(db, weekStart);
    const canEdit = can(user.role, 'vehicle:update');
    const thisWeek = q.mondayOf(today) === weekStart;

    return (
      <>
        <PageHeader
          title="Income sheet"
          subtitle={`${dayLabel(weekStart)} to ${dayLabel(sheet.days[6]!)}${thisWeek ? ' · this week' : ''}`}
          actions={
            <div className="flex flex-wrap items-center gap-2">
              {tabBar}
              <Link href={`/weekly?week=${shift(weekStart, -7)}`} className={btn}>← Prev week</Link>
              <form method="get" className="flex items-center gap-1">
                <input type="date" name="week" defaultValue={weekStart} className="rounded-md border bg-surface px-2 py-1.5 text-sm" />
                <button className={btn}>Go</button>
              </form>
              <Link href={`/weekly?week=${shift(weekStart, 7)}`} className={btn}>Next week →</Link>
              {!thisWeek && <Link href="/weekly" className={btn}>This week</Link>}
              <a href={`/api/export/weekly?week=${weekStart}`} className="rounded-md bg-brand px-3 py-1.5 text-sm font-semibold text-white">Download Excel</a>
            </div>
          }
        />

        <p className="mb-3 text-xs text-muted">
          Each cell is what that truck earned that day (approved, billed trips). Nothing earned? {canEdit ? 'Click the cell and type where it was: PKD JGRD, GARAGED, ENROUTE...' : 'The status word shows here.'} Total = income minus expenses and fuel.
        </p>

        <datalist id="week-notes">
          <option value="GARAGED" />
          <option value="ENROUTE" />
          <option value="OFFLOADING" />
          <option value="PARKED" />
          <option value="PKD JGRD" />
          <option value="PKD OJIJO" />
          <option value="LA OJIJO" />
        </datalist>

        <div className="overflow-x-auto rounded-xl border bg-surface">
          <table className="w-full min-w-[56rem] border-collapse text-sm">
            <thead>
              <tr className="border-b text-xs">
                <th className="px-3 py-2.5 text-left font-semibold text-muted">VEHICLE</th>
                {sheet.days.map((d) => (
                  <th key={d} className="px-2 py-2.5 text-right font-semibold text-brand">
                    <Link href={`/daily?date=${d}`} className="hover:underline" title="See that day's stops and POs">
                      {weekday(d)} <span className="tabular-nums">{dayLabel(d).slice(0, 5)}</span>
                    </Link>
                  </th>
                ))}
                <th className="px-3 py-2.5 text-right font-semibold text-muted">INCOME</th>
                <th className="px-3 py-2.5 text-right font-semibold text-brand">EXPENSES / FUEL</th>
                <th className="px-3 py-2.5 text-right font-semibold text-muted">TOTAL</th>
              </tr>
            </thead>
            <tbody>
              {sheet.rows.map((r) => (
                <tr key={r.vehicleId} className="border-b last:border-0">
                  <td className="px-3 py-1.5 font-semibold">{r.registration}</td>
                  {r.cells.map((c, i) => (
                    <td key={i} className="px-1 py-1 align-top">
                      <WeekCell vehicleId={r.vehicleId} day={sheet.days[i]!} income={c.income} note={c.note} pending={c.pending} canEdit={canEdit} />
                    </td>
                  ))}
                  <td className="px-3 py-1.5 text-right tabular-nums">{r.income ? money(r.income) : ''}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums">{r.expenses ? money(r.expenses) : ''}</td>
                  <td className={`px-3 py-1.5 text-right font-medium tabular-nums ${r.total < 0 ? 'text-crit' : ''}`}>
                    {r.income || r.expenses ? bracket(r.total) : ''}
                  </td>
                </tr>
              ))}
              {sheet.otherExpenses > 0 && (
                <tr className="border-b text-muted">
                  <td className="px-3 py-1.5 italic" colSpan={8}>Costs this week not for one truck</td>
                  <td />
                  <td className="px-3 py-1.5 text-right tabular-nums">{money(sheet.otherExpenses)}</td>
                  <td />
                </tr>
              )}
            </tbody>
            <tfoot>
              <tr className="border-t-2 font-semibold text-crit">
                <td className="px-3 py-2.5" colSpan={8}>WEEK TOTAL</td>
                <td className="px-3 py-2.5 text-right tabular-nums">{money(sheet.totals.income)}</td>
                <td className="px-3 py-2.5 text-right tabular-nums">{money(sheet.totals.expenses)}</td>
                <td className="px-3 py-2.5 text-right tabular-nums">{bracket(sheet.totals.total)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </>
    );
  }

  // ------------------------------------------------------ month / year
  const sheet = await q.rangeSheet(db, view, view === 'month' ? month : year, today);
  const isYear = view === 'year';
  const prev = isYear ? `/weekly?view=year&year=${Number(year) - 1}` : `/weekly?view=month&month=${shiftMonth(month, -1)}`;
  const next = isYear ? `/weekly?view=year&year=${Number(year) + 1}` : `/weekly?view=month&month=${shiftMonth(month, 1)}`;
  const isCurrent = isYear ? year === today.slice(0, 4) : month === today.slice(0, 7);
  const exportHref = `/api/export/weekly?view=${view}&${isYear ? `year=${year}` : `month=${month}`}`;

  return (
    <>
      <PageHeader
        title="Income sheet"
        subtitle={`${sheet.title} · ${dayLabel(sheet.from)} to ${dayLabel(sheet.to)}`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {tabBar}
            <Link href={prev} className={btn}>← {isYear ? 'Prev year' : 'Prev month'}</Link>
            <form method="get" className="flex items-center gap-1">
              <input type="hidden" name="view" value={view} />
              {isYear ? (
                <input type="number" name="year" min={2020} max={2100} defaultValue={year} className="w-24 rounded-md border bg-surface px-2 py-1.5 text-sm" />
              ) : (
                <input type="month" name="month" defaultValue={month} className="rounded-md border bg-surface px-2 py-1.5 text-sm" />
              )}
              <button className={btn}>Go</button>
            </form>
            <Link href={next} className={btn}>{isYear ? 'Next year' : 'Next month'} →</Link>
            {!isCurrent && <Link href={`/weekly?view=${view}`} className={btn}>{isYear ? 'This year' : 'This month'}</Link>}
            <a href={exportHref} className="rounded-md bg-brand px-3 py-1.5 text-sm font-semibold text-white">Download Excel</a>
          </div>
        }
      />

      <p className="mb-3 text-xs text-muted">
        {isYear ? 'A column per month' : 'A column per week'} of what each truck earned (approved, billed trips and tagged one-off invoices). Click a heading to open that {isYear ? 'month' : 'week'}. Total = income minus expenses and fuel.
      </p>

      <div className="overflow-x-auto rounded-xl border bg-surface">
        <table className="w-full min-w-[40rem] border-collapse text-sm">
          <thead>
            <tr className="border-b text-xs">
              <th className="px-3 py-2.5 text-left font-semibold text-muted">VEHICLE</th>
              {sheet.columns.map((c) => (
                <th key={c.label} className="px-2 py-2.5 text-right font-semibold text-brand">
                  <Link href={c.href} className="hover:underline">{c.label}</Link>
                </th>
              ))}
              <th className="px-3 py-2.5 text-right font-semibold text-muted">INCOME</th>
              <th className="px-3 py-2.5 text-right font-semibold text-brand">EXPENSES / FUEL</th>
              <th className="px-3 py-2.5 text-right font-semibold text-muted">TOTAL</th>
            </tr>
          </thead>
          <tbody>
            {sheet.rows.map((r) => (
              <tr key={r.vehicleId} className="border-b last:border-0">
                <td className="px-3 py-2 font-semibold">{r.registration}</td>
                {r.cells.map((c, i) => (
                  <td key={i} className="px-2 py-2 text-right tabular-nums">{c ? money(c) : ''}</td>
                ))}
                <td className="px-3 py-2 text-right tabular-nums">{r.income ? money(r.income) : ''}</td>
                <td className="px-3 py-2 text-right tabular-nums">{r.expenses ? money(r.expenses) : ''}</td>
                <td className={`px-3 py-2 text-right font-medium tabular-nums ${r.total < 0 ? 'text-crit' : ''}`}>
                  {r.income || r.expenses ? bracket(r.total) : ''}
                </td>
              </tr>
            ))}
            {sheet.otherExpenses > 0 && (
              <tr className="border-b text-muted">
                <td className="px-3 py-2 italic" colSpan={sheet.columns.length + 2}>Costs not for one truck</td>
                <td className="px-3 py-2 text-right tabular-nums">{money(sheet.otherExpenses)}</td>
                <td />
              </tr>
            )}
          </tbody>
          <tfoot>
            <tr className="border-t-2 font-semibold text-crit">
              <td className="px-3 py-2.5">{isYear ? 'YEAR TOTAL' : 'MONTH TOTAL'}</td>
              {sheet.columnTotals.map((t, i) => (
                <td key={i} className="px-2 py-2.5 text-right tabular-nums">{t ? money(t) : ''}</td>
              ))}
              <td className="px-3 py-2.5 text-right tabular-nums">{money(sheet.totals.income)}</td>
              <td className="px-3 py-2.5 text-right tabular-nums">{money(sheet.totals.expenses)}</td>
              <td className="px-3 py-2.5 text-right tabular-nums">{bracket(sheet.totals.total)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </>
  );
}
