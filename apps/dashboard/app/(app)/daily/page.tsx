import Link from 'next/link';
import { requirePermission } from '@/lib/session';
import { db, schema } from '@bv/db';
import * as q from '@bv/db/queries';
import { PageHeader, Card, Badge } from '@/components/ui';

export const dynamic = 'force-dynamic';

const nairobiToday = () => new Date(Date.now() + 3 * 3600_000).toISOString().slice(0, 10);
const shift = (key: string, days: number) => {
  const d = new Date(`${key}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

const STATUS_TONE: Record<string, 'ok' | 'warn' | 'crit' | 'muted'> = {
  delivered: 'ok', partial: 'warn', failed: 'crit', returned: 'crit', pending: 'muted', arrived: 'muted',
};

export default async function DailySheetPage({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  await requirePermission('trip:read');
  const sp = await searchParams;
  const date = /^\d{4}-\d{2}-\d{2}$/.test(sp.date ?? '') ? sp.date! : nairobiToday();
  const monthStart = `${date.slice(0, 7)}-01`;

  const [rows, vehicles] = await Promise.all([
    q.dailyRows(db, date, date),
    db.select({ reg: schema.vehicles.registration }).from(schema.vehicles).orderBy(schema.vehicles.registration),
  ]);

  const byVehicle = new Map<string, q.DailyRow[]>();
  for (const r of rows) byVehicle.set(r.vehicle, [...(byVehicle.get(r.vehicle) ?? []), r]);

  const tripCount = new Set(rows.map((r) => r.trip)).size;
  const missingPo = rows.filter((r) => (r.status === 'delivered' || r.status === 'partial') && r.poPhotos === 0).length;
  const failed = rows.filter((r) => r.status === 'failed' || r.status === 'returned').length;
  const label = new Date(`${date}T12:00:00Z`).toLocaleDateString('en-KE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <>
      <PageHeader
        title="Daily sheet"
        subtitle={label}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Link href={`/daily?date=${shift(date, -1)}`} className="rounded-md border px-3 py-1.5 text-sm hover:bg-bg">← Prev</Link>
            <form method="get" className="flex items-center gap-1">
              <input type="date" name="date" defaultValue={date} className="rounded-md border bg-surface px-2 py-1.5 text-sm" />
              <button className="rounded-md border px-3 py-1.5 text-sm hover:bg-bg">Go</button>
            </form>
            <Link href={`/daily?date=${shift(date, 1)}`} className="rounded-md border px-3 py-1.5 text-sm hover:bg-bg">Next →</Link>
            <Link href="/daily" className="rounded-md border px-3 py-1.5 text-sm hover:bg-bg">Today</Link>
          </div>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2 text-sm">
        <Badge tone="brand">{tripCount} trip{tripCount === 1 ? '' : 's'}</Badge>
        <Badge tone="muted">{rows.length} stop{rows.length === 1 ? '' : 's'}</Badge>
        {failed > 0 && <Badge tone="crit">{failed} failed</Badge>}
        {missingPo > 0 && <Badge tone="warn">{missingPo} PO photo{missingPo === 1 ? '' : 's'} pending</Badge>}
        <span className="ml-auto flex gap-2">
          <a href={`/api/export/daily?from=${date}&to=${date}`} className="rounded-md bg-brand px-3 py-1.5 font-semibold text-white">
            Download this day (Excel)
          </a>
          <a href={`/api/export/daily?from=${monthStart}&to=${date}`} className="rounded-md border px-3 py-1.5 hover:bg-bg">
            Month to date
          </a>
        </span>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {vehicles.map(({ reg }) => {
          const list = byVehicle.get(reg) ?? [];
          const first = list[0];
          const trips = [...new Set(list.map((r) => r.trip))];
          return (
            <Card key={reg} className={list.length === 0 ? 'opacity-60' : ''}>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="text-base font-semibold">{reg}</div>
                  <div className="text-xs text-muted">
                    {list.length === 0 ? 'No trip logged' : [...new Set(list.map((r) => r.driver))].join(', ')}
                  </div>
                </div>
                {first && (
                  <div className="text-right text-xs text-muted">
                    {trips.map((t) => {
                      const r = list.find((x) => x.trip === t)!;
                      return (
                        <div key={t}>
                          <Link href={`/trips/${r.tripId}`} className="text-brand hover:underline">{t}</Link>
                          {r.tonnes != null && ` · ${r.tonnes} t`}
                          {r.bales != null && ` · ${r.bales} bales`}
                          {r.fuelLitres != null && ` · fuel ${r.fuelLitres} L`}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
              {list.length > 0 && (
                <ul className="mt-3 divide-y text-sm">
                  {list.map((r) => (
                    <li key={`${r.trip}-${r.stopNo}`} className="flex items-center justify-between gap-2 py-1.5">
                      <span className="min-w-0">
                        <span className="wrap-anywhere">{r.stop}</span>
                        <span className="ml-2 text-xs text-muted">{r.po ? `PO ${r.po}` : 'no PO'}</span>
                      </span>
                      <span className="flex shrink-0 items-center gap-1.5">
                        {(r.status === 'delivered' || r.status === 'partial') && r.poPhotos === 0 && <Badge tone="warn">photo pending</Badge>}
                        <Badge tone={STATUS_TONE[r.status] ?? 'muted'}>{r.status}</Badge>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          );
        })}
      </div>
    </>
  );
}
