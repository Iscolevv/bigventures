'use server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { requirePermission } from '@/lib/session';
import { writeAudit } from '@/lib/audit';
import { db, schema, eq, sql } from '@bv/db';
import { DRIVER_STATUSES } from '@bv/core/enums';
import { createDriver, assignVehicle, unassignDriver, setLoginPassword, isValidEmail } from '@/lib/people';

export async function saveDriver(form: FormData) {
  const id = String(form.get('id') ?? '');
  const user = await requirePermission(id ? 'driver:update' : 'driver:create');
  const name = String(form.get('name') ?? '').trim().replace(/\s+/g, ' ');
  const status = String(form.get('status') ?? 'active');
  const vehicleId = String(form.get('vehicleId') ?? '');
  const password = String(form.get('password') ?? '');
  const email = String(form.get('email') ?? '').trim();
  const back = id ? `/drivers/${id}` : '/drivers/new';
  const fail = (m: string): never => redirect(`${back}?error=${encodeURIComponent(m)}`);

  if (!name) fail('Name is required');
  if (email && !isValidEmail(email)) fail('Enter the full email address, like name@company.com');
  if (!(DRIVER_STATUSES as readonly string[]).includes(status)) fail('Invalid status');

  if (!id) {
    if (password.length < 8) fail('Set a starting password of at least 8 characters');
    try {
      const r = await createDriver({ name, password, email: email || undefined, vehicleId: vehicleId || null, assignedBy: user.id });
      await writeAudit(user, 'create', 'driver', r.driverId, null, { name });
    } catch {
      fail('That login email is already taken');
    }
  } else {
    const [d] = await db.select({ userId: schema.drivers.user_id }).from(schema.drivers).where(eq(schema.drivers.id, id)).limit(1);
    if (!d) fail('Driver not found');
    const active = status === 'active' || status === 'on_leave';
    await db.update(schema.drivers).set({ full_name: name, status: status as 'active', updated_at: new Date() }).where(eq(schema.drivers.id, id));
    await db.update(schema.user).set({ name, status: active ? 'active' : 'suspended', updatedAt: new Date() }).where(eq(schema.user.id, d!.userId));
    if (vehicleId) await assignVehicle(id, vehicleId, user.id);
    else await unassignDriver(id);
    if (password) {
      if (password.length < 8) fail('Password must be at least 8 characters');
      await setLoginPassword(d!.userId, password);
    }
    await writeAudit(user, 'update', 'driver', id, null, { name, status, vehicleId: vehicleId || null, passwordReset: !!password });
  }
  revalidatePath('/drivers');
  redirect('/drivers');
}

/** Remove a driver who has no trips yet. Someone with history can't be deleted - set them to resigned instead. */
export async function deleteDriver(form: FormData) {
  const actor = await requirePermission('driver:delete');
  const id = String(form.get('id') ?? '');
  const back = (m: string): never => redirect(`/drivers/${id}?error=${encodeURIComponent(m)}`);

  const [d] = await db.select({ userId: schema.drivers.user_id, name: schema.drivers.full_name }).from(schema.drivers).where(eq(schema.drivers.id, id)).limit(1);
  if (!d) redirect('/drivers');
  const [{ n } = { n: 0 }] = await db.select({ n: sql<number>`count(*)::int` }).from(schema.trips).where(eq(schema.trips.driver_id, id));
  if (n > 0) back(`${d!.name} has ${n} trip${n === 1 ? '' : 's'} on record, so can't be deleted. Set the status to Resigned instead.`);

  try {
    await db.delete(schema.drivers).where(eq(schema.drivers.id, id));
    await db.execute(sql`delete from bigventures.session where "userId" = ${d!.userId}`);
    await db.execute(sql`delete from bigventures.account where "userId" = ${d!.userId}`);
    await db.delete(schema.user).where(eq(schema.user.id, d!.userId));
  } catch {
    back(`${d!.name} has other records attached. Set the status to Resigned instead.`);
  }
  await writeAudit(actor, 'delete', 'driver', id, { name: d!.name }, null);
  revalidatePath('/drivers');
  redirect('/drivers');
}
