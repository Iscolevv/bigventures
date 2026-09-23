import Link from 'next/link';
import { requirePermission, can } from '@/lib/session';
import { db } from '@bv/db';
import * as q from '@bv/db/queries';
import { PageHeader, DataTable, Badge, type Column } from '@/components/ui';

export const dynamic = 'force-dynamic';

export default async function DriversPage() {
  const user = await requirePermission('driver:read');
  const canEdit = can(user.role, 'driver:update');
  const rows = await q.driverRoster(db);

  const columns: Column<(typeof rows)[number]>[] = [
    { key: 'name', header: 'Driver', render: (r) => <span className="font-medium">{r.name}</span> },
    { key: 'login', header: 'Login', render: (r) => <span className="text-muted">{r.email}</span> },
    { key: 'vehicle', header: 'Usual vehicle', render: (r) => r.assignedVehicle ?? (r.recentVehicle ? <span className="text-muted" title="Not set - shown because they drove it most in the last 30 days">{r.recentVehicle} <span className="text-xs">(most used lately)</span></span> : <span className="text-muted">-</span>) },
    {
      key: 'status',
      header: 'Status',
      render: (r) => <Badge tone={r.status === 'active' ? 'ok' : 'muted'}>{r.status.replace('_', ' ')}</Badge>,
    },
    { key: 'trips', header: 'Trips (30d)', align: 'right', render: (r) => r.tripsLast30 },
    {
      key: 'edit',
      header: '',
      align: 'right',
      render: (r) =>
        canEdit && (
          <Link href={`/drivers/${r.id}`} className="text-brand hover:underline">
            Edit
          </Link>
        ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Drivers"
        subtitle={`${rows.length} drivers`}
        actions={
          can(user.role, 'driver:create') && (
            <Link href="/drivers/new" className="rounded-md bg-brand px-3 py-2 text-sm font-semibold text-white">
              + Add driver
            </Link>
          )
        }
      />
      <DataTable columns={columns} rows={rows} empty="No drivers yet. Add the first one." />
    </>
  );
}
