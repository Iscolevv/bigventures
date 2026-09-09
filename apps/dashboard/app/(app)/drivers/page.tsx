import Link from 'next/link';
import { requirePermission } from '@/lib/session';
import { db } from '@bv/db';
import * as q from '@bv/db/queries';
import { PageHeader, DataTable, Badge, kes, type Column } from '@/components/ui';

export const dynamic = 'force-dynamic';

function licenceTone(expiry: string | null): 'ok' | 'warn' | 'crit' {
  if (!expiry) return 'warn';
  const days = (new Date(expiry).getTime() - Date.now()) / 86_400_000;
  if (days < 0) return 'crit';
  if (days < 45) return 'warn';
  return 'ok';
}

export default async function DriversPage() {
  await requirePermission('driver:read');
  const rows = await q.driverRoster(db);

  const columns: Column<(typeof rows)[number]>[] = [
    { key: 'name', header: 'Driver', render: (r) => <span className="font-medium">{r.name}</span> },
    { key: 'vehicle', header: 'Vehicle', render: (r) => r.assignedVehicle ?? <span className="text-muted">—</span> },
    { key: 'phone', header: 'Phone', render: (r) => <span className="text-muted">{r.phone}</span> },
    {
      key: 'licence',
      header: 'Licence expiry',
      render: (r) => (
        <Badge tone={licenceTone(r.licenseExpiry)}>
          {r.licenseExpiry ? new Date(r.licenseExpiry).toLocaleDateString('en-KE', { day: '2-digit', month: 'short', year: '2-digit' }) : 'missing'}
        </Badge>
      ),
    },
    { key: 'trips', header: 'Trips (30d)', align: 'right', render: (r) => r.tripsLast30 },
    {
      key: 'quality',
      header: 'Quality',
      align: 'right',
      render: (r) =>
        r.qualityScore == null ? (
          <span className="text-muted">—</span>
        ) : (
          <Badge tone={r.qualityScore >= 0.9 ? 'ok' : r.qualityScore >= 0.75 ? 'warn' : 'crit'}>
            {(r.qualityScore * 100).toFixed(0)}
          </Badge>
        ),
    },
    { key: 'base', header: 'Base', align: 'right', render: (r) => kes(r.baseSalary) },
    {
      key: 'advance',
      header: 'Advance bal.',
      align: 'right',
      render: (r) => (
        <span className={r.advanceBalance > 20000 ? 'text-warn' : ''}>{kes(r.advanceBalance)}</span>
      ),
    },
    {
      key: 'loss',
      header: 'Loss bal.',
      align: 'right',
      render: (r) => (r.lossBalance > 0 ? <span className="text-crit">{kes(r.lossBalance)}</span> : <span className="text-muted">—</span>),
    },
  ];

  const totalAdvances = rows.reduce((s, r) => s + r.advanceBalance, 0);

  return (
    <>
      <PageHeader
        title="Drivers"
        subtitle={`${rows.length} drivers · ${kes(totalAdvances)} advances outstanding`}
        actions={
          <Link href="/documents?owner=driver" className="rounded-md border px-3 py-1.5 text-sm hover:bg-bg">
            Compliance docs
          </Link>
        }
      />
      <DataTable columns={columns} rows={rows} empty="No drivers — run pnpm db:seed" />
    </>
  );
}
