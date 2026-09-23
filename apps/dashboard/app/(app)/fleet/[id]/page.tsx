import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requirePermission } from '@/lib/session';
import { db, schema, eq, sql } from '@bv/db';
import { VEHICLE_TYPES, VEHICLE_STATUSES } from '@bv/core/enums';
import { PageHeader, Card } from '@/components/ui';
import { saveVehicle, deleteVehicle } from '../actions';
import { ConfirmSubmit } from '@/components/ConfirmSubmit';

export const dynamic = 'force-dynamic';
const input = 'mt-1 w-full rounded-md border bg-surface px-3 py-2 text-sm';

export default async function VehicleEditPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  await requirePermission(id === 'new' ? 'vehicle:create' : 'vehicle:update');
  const { error } = await searchParams;
  const v = id === 'new' ? null : (await db.select().from(schema.vehicles).where(eq(schema.vehicles.id, id)).limit(1))[0];
  if (id !== 'new' && !v) notFound();
  const driverList = await db.select({ id: schema.drivers.id, name: schema.drivers.full_name }).from(schema.drivers).orderBy(schema.drivers.full_name);
  const currentDriver = v
    ? ((await db.execute(sql`select driver_id from bigventures.vehicle_assignments where vehicle_id = ${v.id} and end_date is null limit 1`)).rows[0] as { driver_id: string } | undefined)?.driver_id ?? ''
    : '';

  return (
    <>
      <PageHeader
        title={v ? `Edit ${v.registration}` : 'Add vehicle'}
        actions={
          <Link href="/fleet" className="rounded-md border px-3 py-1.5 text-sm hover:bg-bg">
            ← Fleet
          </Link>
        }
      />
      <Card className="max-w-xl">
        <form action={saveVehicle} className="space-y-4">
          {v && <input type="hidden" name="id" value={v.id} />}
          <label className="block text-sm font-medium">
            Registration
            <input name="registration" required defaultValue={v?.registration ?? ''} placeholder="KCD 448E" className={`${input} uppercase`} />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-sm font-medium">
              Type
              <select name="vehicle_type" defaultValue={v?.vehicle_type ?? 'truck'} className={`${input} capitalize`}>
                {VEHICLE_TYPES.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </label>
            <label className="block text-sm font-medium">
              Status
              <select name="status" defaultValue={v?.status ?? 'active'} className={`${input} capitalize`}>
                {VEHICLE_STATUSES.map((s) => (
                  <option key={s} value={s}>{s.replace('_', ' ')}</option>
                ))}
              </select>
            </label>
          </div>
          <label className="block text-sm font-medium">
            Usual driver (optional)
            <select name="driverId" defaultValue={currentDriver} className={input}>
              <option value="">None</option>
              {driverList.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
            <span className="mt-1 block text-xs font-normal text-muted">
              Only a label and a shortcut: this driver sees this truck first when logging a trip. Any driver can still use any truck. If you leave it blank, the list shows whoever has driven it most in the last 30 days.
            </span>
          </label>
          <label className="block text-sm font-medium">
            Notes (optional)
            <input name="notes" defaultValue={v?.notes ?? ''} className={input} />
          </label>
          {error && <p className="text-sm text-crit">{error}</p>}
          <button className="rounded-md bg-brand px-4 py-2 text-sm font-semibold text-white">Save</button>
        </form>
        {v && (
          <form action={deleteVehicle} className="mt-4 border-t pt-4">
            <input type="hidden" name="id" value={v.id} />
            <ConfirmSubmit message={'Delete ' + v.registration + '? Only possible if it has never been used.'} className="text-sm text-crit hover:underline">
              Delete this vehicle
            </ConfirmSubmit>
          </form>
        )}
      </Card>
    </>
  );
}
