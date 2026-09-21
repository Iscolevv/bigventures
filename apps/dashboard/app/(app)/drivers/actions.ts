'use server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { requirePermission } from '@/lib/session';
import { writeAudit } from '@/lib/audit';
import { db, schema, eq } from '@bv/db';
import { DRIVER_STATUSES } from '@bv/core/enums';
import { createDriver, assignVehicle, unassignDriver, setLoginPassword } from '@/lib/people';

export async function saveDriver(form: FormData) {
  const id = String(form.get('id') ?? '');
  const user = await requirePermission(id ? 'driver:update' : 'driver:create');
  const name = String(form.get('name') ?? '').trim().replace(/\s+/g, ' ');
  const status = String(form.get('status') ?? 'active');
  const vehicleId = String(form.get('vehicleId') ?? '');
  const password = String(form.get('password') ?? '');
  const email = String(form.get('email') ?? '').trim();
  const salaryRaw = Number(form.get('baseSalary') || 0);
  const salary = Number.isFinite(salaryRaw) && salaryRaw >= 0 ? salaryRaw : 0;
  const back = id ? `/drivers/${id}` : '/drivers/new';
  const fail = (m: string): never => redirect(`${back}?error=${encodeURIComponent(m)}`);

  if (!name) fail('Name is required');
  if (!(DRIVER_STATUSES as readonly string[]).includes(status)) fail('Invalid status');

  if (!id) {
    if (password.length < 8) fail('Set a starting password of at least 8 characters');
    try {
      const r = await createDriver({ name, password, email: email || undefined, vehicleId: vehicleId || null, assignedBy: user.id });
      if (salary > 0) await db.update(schema.drivers).set({ base_salary: String(salary) }).where(eq(schema.drivers.id, r.driverId));
      await writeAudit(user, 'create', 'driver', r.driverId, null, { name });
    } catch {
      fail('That login email is already taken');
    }
  } else {
    const [d] = await db.select({ userId: schema.drivers.user_id }).from(schema.drivers).where(eq(schema.drivers.id, id)).limit(1);
    if (!d) fail('Driver not found');
    const active = status === 'active' || status === 'on_leave';
    await db.update(schema.drivers).set({ full_name: name, status: status as 'active', base_salary: String(salary), updated_at: new Date() }).where(eq(schema.drivers.id, id));
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
