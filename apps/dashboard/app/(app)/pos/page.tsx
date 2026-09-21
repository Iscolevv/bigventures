import Link from 'next/link';
import { requirePermission } from '@/lib/session';
import { db } from '@bv/db';
import * as q from '@bv/db/queries';
import { PO_UPLOAD_WINDOW_HOURS } from '@bv/core/reference';
import { PageHeader, DataTable, Badge, dateTime, type Column } from '@/components/ui';
import { Pager, pageParam } from '@/components/Pager';

export const dynamic = 'force-dynamic';

const FILTERS: { key: q.PoFilter; label: string }[] = [
  { key: 'all', label: 'All POs' },
  { key: 'missing', label: 'Photo missing' },
  { key: 'overdue', label: `Overdue (over ${PO_UPLOAD_WINDOW_HOURS}h)` },
];

export default async function PoSearchPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requirePermission('trip:read');
  const sp = await searchParams;
  const filter = (['all', 'missing', 'overdue'] as const).find((f) => f === sp.filter) ?? 'all';

  const result = await q.poSearch(db, {
    q: sp.q,
    filter,
    windowHours: PO_UPLOAD_WINDOW_HOURS,
    page: pageParam(sp),
    pageSize: 30,
  });

  const columns: Column<(typeof result.rows)[number]>[] = [
    { key: 'po', header: 'PO', render: (r) => <span className="font-semibold">{r.po ?? <span className="text-muted">no number</span>}</span> },
    { key: 'dest', header: 'Stop', render: (r) => r.destination },
    { key: 'driver', header: 'Responsible', render: (r) => (<div><div className="font-medium">{r.driver}</div><div className="text-xs text-muted">{r.vehicle}</div></div>) },
    {
      key: 'trip',
      header: 'Trip',
      render: (r) => (
        <Link href={`/trips/${r.tripId}`} className="font-medium text-brand hover:underline">
          {r.tripRef}
        </Link>
      ),
    },
    { key: 'when', header: 'Delivered', render: (r) => <span className="text-muted">{dateTime(r.tripDate)}</span> },
    {
      key: 'photo',
      header: 'PO photo',
      render: (r) =>
        r.photos > 0 ? (
          <Badge tone="ok">{r.photos} on file</Badge>
        ) : r.status === 'failed' || r.status === 'returned' ? (
          <span className="text-muted">n/a ({r.status})</span>
        ) : r.overdue ? (
          <Badge tone="crit">overdue</Badge>
        ) : (
          <Badge tone="warn">waiting</Badge>
        ),
    },
  ];

  return (
    <>
      <PageHeader title="PO search" subtitle="Every drop has its own PO. Find one to see who is responsible." />
      <form className="mb-4 flex flex-wrap items-center gap-2" method="get">
        <input
          name="q"
          defaultValue={sp.q ?? ''}
          placeholder="PO number, store, trip, driver or plate"
          className="min-w-[16rem] flex-1 rounded-md border bg-surface px-3 py-2 text-sm"
        />
        <select name="filter" defaultValue={filter} className="rounded-md border bg-surface px-3 py-2 text-sm">
          {FILTERS.map((f) => (
            <option key={f.key} value={f.key}>{f.label}</option>
          ))}
        </select>
        <button className="rounded-md bg-brand px-4 py-2 text-sm font-semibold text-white">Search</button>
      </form>
      <DataTable columns={columns} rows={result.rows} empty="No POs match." />
      <Pager {...result} searchParams={sp} basePath="/pos" />
    </>
  );
}
