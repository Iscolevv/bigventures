import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requirePermission, can } from '@/lib/session';
import { objectUrl } from '@/lib/storage';
import { RemovePodButton } from '@/components/RemovePodButton';
import { db } from '@bv/db';
import * as q from '@bv/db/queries';
import { PageHeader, Card, Badge, StatTile, kes, dateTime, type Column, DataTable } from '@/components/ui';

export const dynamic = 'force-dynamic';

const DROP_TONE: Record<string, 'ok' | 'warn' | 'crit' | 'muted'> = {
  delivered: 'ok',
  partial: 'warn',
  failed: 'crit',
  returned: 'crit',
  pending: 'muted',
  arrived: 'muted',
};

export default async function TripDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePermission('trip:read');
  const canRemovePod = can(user.role, 'pod:delete');
  const { id } = await params;
  const detail = await q.tripDetail(db, id);
  if (!detail) notFound();

  const { trip, drops, podPhotos, fuel, costs } = detail;
  const podUrls = await Promise.all(podPhotos.map(async (p) => ({ ...p, url: (await objectUrl(p.key)) ?? p.key })));
  const fuelTotal = fuel.reduce((s, f) => s + f.totalCost, 0);
  const costTotal = costs.reduce((s, c) => s + c.amount, 0);

  const dropCols: Column<(typeof drops)[number]>[] = [
    { key: 'seq', header: '#', render: (d) => d.sequence },
    { key: 'po', header: 'PO', render: (d) => (d.poNumber ? <span className="font-semibold">{d.poNumber}</span> : <span className="text-muted">-</span>) },
    { key: 'addr', header: 'Destination', render: (d) => <span className="font-medium">{d.address}</span> },
    { key: 'status', header: 'Status', render: (d) => <Badge tone={DROP_TONE[d.status] ?? 'muted'}>{d.status}</Badge> },
    { key: 'signee', header: 'Received by', render: (d) => <span className="text-muted">{d.signee ?? '-'}</span> },
    { key: 'issue', header: 'Issue', render: (d) => (d.issueCategory ? <Badge tone="crit">{d.issueCategory}</Badge> : '') },
  ];

  return (
    <>
      <PageHeader
        title={trip.ref}
        subtitle={`${trip.vehicle} · ${trip.driver}${trip.route ? ` · ${trip.route}` : ''}`}
        actions={
          <Link href="/trips" className="rounded-md border px-3 py-1.5 text-sm hover:bg-bg">
            ← All trips
          </Link>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Badge tone={trip.status === 'flagged' ? 'crit' : trip.status === 'completed' ? 'ok' : 'brand'}>
          {trip.status.replace('_', ' ')}
        </Badge>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Load" value={[trip.loadTonnes ? trip.loadTonnes + " t" : null, trip.loadBales ? trip.loadBales + " bales" : null].filter(Boolean).join(" · ") || "-"} />
        <StatTile label="Fuel (litres)" value={fuel.reduce((a, f) => a + f.litres, 0).toFixed(0)} />
        <StatTile label="Fuel" value={kes(fuelTotal)} />
        <StatTile label="Other costs" value={kes(costTotal)} />
      </div>

      {trip.status === 'submitted' && (
        <Link href="/approvals" className="mt-4 block rounded-xl border border-warn bg-warn/10 px-4 py-3 text-sm font-semibold text-warn">
          Waiting for approval - it is not counted in the numbers yet. Review and approve →
        </Link>
      )}

      <h2 className="mb-2 mt-6 text-sm font-semibold">Drops</h2>
      <DataTable columns={dropCols} rows={drops} />

      {podUrls.length > 0 && (
        <>
          <h2 className="mb-2 mt-6 text-sm font-semibold">PO photos</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {podUrls.map((ph) => {
              const drop = drops.find((d) => d.id === ph.dropId);
              return (
                <div key={ph.id} className="rounded-lg border bg-surface p-2">
                  <a href={ph.url} target="_blank" rel="noreferrer">
                    <img src={ph.url} alt="PO" className="aspect-square w-full rounded-md object-cover" />
                  </a>
                  <div className="mt-1.5 flex items-center justify-between gap-2 text-xs">
                    <span className="font-medium">{drop?.poNumber ? `PO ${drop.poNumber}` : `Stop ${drop?.sequence ?? ''}`}</span>
                    {canRemovePod && <RemovePodButton photoId={ph.id} />}
                  </div>
                </div>
              );
            })}
          </div>
          {!canRemovePod && <p className="mt-2 text-xs text-muted">Once uploaded, a PO photo can only be removed by a supervisor.</p>}
        </>
      )}

      <div className="mt-6 max-w-xl">
        <Card title="Fuel & costs">
          {fuel.length === 0 && costs.length === 0 ? (
            <p className="text-sm text-muted">Nothing logged.</p>
          ) : (
            <ul className="space-y-1.5 text-sm">
              {fuel.map((f) => (
                <li key={f.id} className="flex justify-between">
                  <span>{f.litres} L - {f.station ?? 'fuel'}</span>
                  <span className="tabular-nums">{kes(f.totalCost)}</span>
                </li>
              ))}
              {costs.map((c) => (
                <li key={c.id} className="flex justify-between">
                  <span className="capitalize">{c.category} - {c.description ?? ''}</span>
                  <span className="tabular-nums">{kes(c.amount)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

    </>
  );
}
