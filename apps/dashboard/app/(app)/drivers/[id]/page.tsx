import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requirePermission } from '@/lib/session';
import { db, schema, eq, sql } from '@bv/db';
import { DRIVER_STATUSES } from '@bv/core/enums';
import { PageHeader, Card } from '@/components/ui';
import { saveDriver } from '../actions';

export const dynamic = 'force-dynamic';
const input = 'mt-1 w-full rounded-md border bg-surface px-3 py-2 text-sm';

export default async function DriverEditPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  await requirePermission(id === 'new' ? 'driver:create' : 'driver:update');
  const { error } = await searchParams;

  const vehicles = await db
    .select({ id: schema.vehicles.id, reg: schema.vehicles.registration })
    .from(schema.vehicles)
    .orderBy(schema.vehicles.registration);

  let d: { name: string; status: string; email: string | null; vehicleId: string | null; salary: string } | null = null;
  if (id !== 'new') {
    const [row] = await db
      .select({
        name: schema.drivers.full_name,
        status: schema.drivers.status,
        salary: schema.drivers.base_salary,
        email: schema.user.email,
        vehicleId: sql<string | null>`(select a.vehicle_id from bigventures.vehicle_assignments a where a.driver_id = ${schema.drivers.id} and a.end_date is null limit 1)`,
      })
      .from(schema.drivers)
      .leftJoin(schema.user, eq(schema.user.id, schema.drivers.user_id))
      .where(eq(schema.drivers.id, id))
      .limit(1);
    if (!row) notFound();
    d = row;
  }

  return (
    <>
      <PageHeader
        title={d ? `Edit ${d.name}` : 'Add driver'}
        actions={
          <Link href="/drivers" className="rounded-md border px-3 py-1.5 text-sm hover:bg-bg">
            ← Drivers
          </Link>
        }
      />
      <Card className="max-w-xl">
        <form action={saveDriver} className="space-y-4">
          {d && <input type="hidden" name="id" value={id} />}
          <label className="block text-sm font-medium">
            Full name
            <input name="name" required defaultValue={d?.name ?? ''} className={input} />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-sm font-medium">
              Status
              <select name="status" defaultValue={d?.status ?? 'active'} className={`${input} capitalize`}>
                {DRIVER_STATUSES.map((s) => (
                  <option key={s} value={s}>{s.replace('_', ' ')}</option>
                ))}
              </select>
            </label>
            <label className="block text-sm font-medium">
              Usual vehicle (optional)
              <select name="vehicleId" defaultValue={d?.vehicleId ?? ''} className={input}>
                <option value="">None - picks a truck each trip</option>
                {vehicles.map((v) => (
                  <option key={v.id} value={v.id}>{v.reg}</option>
                ))}
              </select>
            </label>
          </div>
          <label className="block text-sm font-medium">
            Monthly base salary (Ksh) - used by payroll and incentives
            <input name="baseSalary" inputMode="decimal" defaultValue={d && Number(d.salary) > 0 ? Number(d.salary) : ''} className={input} placeholder="e.g. 20000" />
          </label>
          <div className="border-t pt-4">
            <p className="text-sm font-medium">Login</p>
            {d ? (
              <p className="mt-1 text-sm text-muted">
                Signs in as <span className="font-medium text-fg">{d.email}</span>
              </p>
            ) : (
              <label className="mt-2 block text-sm font-medium">
                Login email (optional, made from the name if blank)
                <input name="email" type="email" className={input} />
              </label>
            )}
            <label className="mt-3 block text-sm font-medium">
              {d ? 'Reset password (leave blank to keep)' : 'Starting password'}
              <input name="password" type="text" minLength={8} required={!d} placeholder="min 8 characters" className={input} autoComplete="off" />
            </label>
          </div>
          {error && <p className="text-sm text-crit">{error}</p>}
          <button className="rounded-md bg-brand px-4 py-2 text-sm font-semibold text-white">Save</button>
        </form>
      </Card>
    </>
  );
}
