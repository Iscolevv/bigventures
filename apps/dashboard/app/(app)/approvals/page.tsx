import Link from 'next/link';
import { requirePermission } from '@/lib/session';
import { objectUrl } from '@/lib/storage';
import { db, schema, eq } from '@bv/db';
import * as q from '@bv/db/queries';
import { PageHeader, Card, Badge, dateTime } from '@/components/ui';
import { approveTrip } from './actions';

export const dynamic = 'force-dynamic';
const input = 'mt-1 w-full rounded-md border bg-surface px-3 py-2 text-sm';

const STOP_TONE: Record<string, 'ok' | 'warn' | 'crit' | 'muted'> = {
  delivered: 'ok', partial: 'warn', failed: 'crit', returned: 'crit', pending: 'muted', arrived: 'muted',
};

export default async function ApprovalsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; trip?: string; approved?: string }>;
}) {
  await requirePermission('trip:approve');
  const sp = await searchParams;
  const trips = await q.pendingTrips(db);
  const clients = await db
    .select({ id: schema.clients.id, name: schema.clients.name, rate: schema.clients.default_trip_rate })
    .from(schema.clients)
    .where(eq(schema.clients.active, true))
    .orderBy(schema.clients.name);

  const withUrls = await Promise.all(
    trips.map(async (t) => ({
      ...t,
      drops: await Promise.all(
        t.drops.map(async (d) => ({ ...d, photos: await Promise.all(d.photoKeys.map(async (k) => (await objectUrl(k)) ?? k)) })),
      ),
    })),
  );

  return (
    <>
      <PageHeader
        title="Approvals"
        subtitle={withUrls.length === 0 ? 'Nothing waiting' : `${withUrls.length} trip${withUrls.length === 1 ? '' : 's'} waiting. They count in the numbers once you approve.`}
      />
      {sp.approved && <p className="mb-3 rounded-lg border border-ok/40 bg-ok/10 px-3 py-2 text-sm text-ok">Approved. It now counts in the numbers.</p>}

      <div className="space-y-4">
        {withUrls.map((t) => (
          <Card key={t.id}>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <div className="text-base font-semibold">{t.driver} · {t.vehicle}</div>
                <div className="text-xs text-muted">
                  <Link href={`/trips/${t.id}`} className="text-brand hover:underline">{t.ref}</Link> · trip date {t.date} · logged {dateTime(t.loggedAt)}
                </div>
              </div>
              <Badge tone="warn">awaiting approval</Badge>
            </div>

            <ul className="mt-3 divide-y text-sm">
              {t.drops.map((d) => (
                <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <div className="min-w-0">
                    <span className="wrap-anywhere">{d.sequence}. {d.destination}</span>
                    <span className="ml-2 text-xs text-muted">
                      {d.po ? `PO ${d.po}` : 'no PO'}
                      {d.signee ? ` · received by ${d.signee}` : ''}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {d.photos.map((u) => (
                      <a key={u} href={u} target="_blank" rel="noreferrer">
                        <img src={u} alt="PO" className="h-10 w-10 rounded object-cover" />
                      </a>
                    ))}
                    {(d.status === 'delivered' || d.status === 'partial') && d.photos.length === 0 && <Badge tone="warn">photo pending</Badge>}
                    <Badge tone={STOP_TONE[d.status] ?? 'muted'}>{d.status}</Badge>
                  </div>
                </li>
              ))}
            </ul>

            <form action={approveTrip} className="mt-4 grid gap-3 border-t pt-4 sm:grid-cols-2 lg:grid-cols-4">
              <input type="hidden" name="id" value={t.id} />
              <label className="text-sm font-medium">
                Tonnes
                <input name="tonnes" inputMode="decimal" defaultValue={t.tonnes ?? ''} className={input} />
              </label>
              <label className="text-sm font-medium">
                Bales
                <input name="bales" inputMode="numeric" defaultValue={t.bales ?? ''} className={input} />
              </label>
              <label className="text-sm font-medium">
                Fuel (litres)
                <input name="litres" inputMode="decimal" defaultValue={t.fuelLitres ?? ''} className={input} />
              </label>
              <label className="text-sm font-medium">
                Fuel cost (Ksh)
                <input name="cost" inputMode="decimal" defaultValue={t.fuelCost ? t.fuelCost : ''} className={input} placeholder="total paid" />
              </label>
              <label className="text-sm font-medium">
                Client
                <select name="clientId" defaultValue="" className={input}>
                  <option value="">No client (not billed)</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}{c.rate ? ` - usual Ksh ${Number(c.rate).toLocaleString()}` : ''}</option>
                  ))}
                </select>
              </label>
              <label className="text-sm font-medium">
                Amount to bill (Ksh)
                <input name="billed" inputMode="decimal" className={input} placeholder="blank = client's usual rate" />
              </label>
              <label className="text-sm font-medium">
                Start odometer (km)
                <input name="startOdometer" inputMode="numeric" defaultValue={t.startOdometer ?? ''} className={input} placeholder={t.startOdometer == null ? 'not recorded - add if you know it' : undefined} />
                {t.startOdometer != null && <span className="mt-1 block text-xs font-normal text-muted">from the driver's morning check</span>}
              </label>
              <label className="text-sm font-medium">
                End odometer (km)
                <input name="endOdometer" inputMode="numeric" defaultValue={t.endOdometer ?? ''} className={input} placeholder={t.endOdometer == null ? 'not recorded - add if you know it' : undefined} />
                {t.endOdometer != null && <span className="mt-1 block text-xs font-normal text-muted">closing reading from the driver</span>}
              </label>
              <div className="flex items-end lg:col-span-2">
                <button className="rounded-md bg-brand px-6 py-2 text-sm font-semibold text-white">Approve</button>
              </div>
            </form>
            {sp.error && sp.trip === t.id && <p className="mt-2 text-sm text-crit">{sp.error}</p>}
          </Card>
        ))}
        {withUrls.length === 0 && (
          <Card>
            <p className="text-sm text-muted">Every logged trip has been approved. New ones appear here as drivers log them.</p>
          </Card>
        )}
      </div>
    </>
  );
}
