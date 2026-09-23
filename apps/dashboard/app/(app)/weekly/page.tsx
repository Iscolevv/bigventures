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
const dayLabel = (key: string) => {
  const [y, m, d] = key.split('-');
  return `${d}/${m}/${y}`;
};
const weekday = (key: string) => new Date(`${key}T12:00:00Z`).toLocaleDateString('en-KE', { weekday: 'short', timeZone: 'UTC' });
const money = (n: number) => n.toLocaleString('en-KE', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
/** the Excel way: negatives in brackets */
const bracket = (n: number) => (n < 0 ? `(${money(Math.abs(n))})` : money(n));

export default async function WeeklySheetPage({ searchParams }: { searchParams: Promise<{ week?: string }> }) {
  const user = await requirePermission('trip:read');
  const sp = await searchParams;
  const pick = /^\d{4}-\d{2}-\d{2}$/.test(sp.week ?? '') ? sp.week! : nairobiToday();
  const weekStart = q.mondayOf(pick);
  const sheet = await q.weeklySheet(db, weekStart);
  const canEdit = can(user.role, 'vehicle:update');
  const thisWeek = q.mondayOf(nairobiToday()) === weekStart;

  return (
    <>
      <PageHeader
        title="Weekly sheet"
        subtitle={`${dayLabel(weekStart)} to ${dayLabel(sheet.days[6]!)}${thisWeek ? ' · this week' : ''}`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Link href={`/weekly?week=${shift(weekStart, -7)}`} className="rounded-md border px-3 py-1.5 text-sm hover:bg-bg">← Prev week</Link>
            <form method="get" className="flex items-center gap-1">
              <input type="date" name="week" defaultValue={weekStart} className="rounded-md border bg-surface px-2 py-1.5 text-sm" />
              <button className="rounded-md border px-3 py-1.5 text-sm hover:bg-bg">Go</button>
            </form>
            <Link href={`/weekly?week=${shift(weekStart, 7)}`} className="rounded-md border px-3 py-1.5 text-sm hover:bg-bg">Next week →</Link>
            {!thisWeek && <Link href="/weekly" className="rounded-md border px-3 py-1.5 text-sm hover:bg-bg">This week</Link>}
            <a href={`/api/export/weekly?week=${weekStart}`} className="rounded-md bg-brand px-3 py-1.5 text-sm font-semibold text-white">
              Download Excel
            </a>
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
