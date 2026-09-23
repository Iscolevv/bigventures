'use server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { requirePermission } from '@/lib/session';
import { writeAudit } from '@/lib/audit';
import { db, schema, eq, sql } from '@bv/db';
import { VEHICLE_TYPES, VEHICLE_STATUSES } from '@bv/core/enums';

/** "kcd448e" / "KCD 448E" -> "KCD 448E" */
function normalizeReg(raw: string) {
  const s = raw.toUpperCase().replace(/\s+/g, '');
  const m = s.match(/^([A-Z]{3})(\d{3})([A-Z])$/);
  return m ? `${m[1]} ${m[2]}${m[3]}` : raw.toUpperCase().trim();
}

export async function saveVehicle(form: FormData) {
  const id = String(form.get('id') ?? '');
  const user = await requirePermission(id ? 'vehicle:update' : 'vehicle:create');
  const registration = normalizeReg(String(form.get('registration') ?? ''));
  const type = String(form.get('vehicle_type') ?? 'truck');
  const status = String(form.get('status') ?? 'active');
  const notes = String(form.get('notes') ?? '').trim() || null;
  const back = id ? `/fleet/${id}` : '/fleet/new';
  if (!registration) redirect(`${back}?error=${encodeURIComponent('Registration is required')}`);
  if (!(VEHICLE_TYPES as readonly string[]).includes(type) || !(VEHICLE_STATUSES as readonly string[]).includes(status)) {
    redirect(`${back}?error=${encodeURIComponent('Invalid type or status')}`);
  }
  const values = { registration, vehicle_type: type as 'truck', status: status as 'active', notes };
  try {
    if (id) {
      await db.update(schema.vehicles).set({ ...values, updated_at: new Date() }).where(eq(schema.vehicles.id, id));
      await writeAudit(user, 'update', 'vehicle', id, null, values);
    } else {
      const [row] = await db.insert(schema.vehicles).values(values).returning({ id: schema.vehicles.id });
      await writeAudit(user, 'create', 'vehicle', row!.id, null, values);
    }
  } catch {
    redirect(`${back}?error=${encodeURIComponent('That registration already exists')}`);
  }
  revalidatePath('/fleet');
  redirect('/fleet');
}

/** Remove a truck that has never been used. One with history can't be deleted - mark it Sold or Inactive instead. */
export async function deleteVehicle(form: FormData) {
  const actor = await requirePermission('vehicle:delete');
  const id = String(form.get('id') ?? '');
  const back = (m: string): never => redirect(`/fleet/${id}?error=${encodeURIComponent(m)}`);

  const [v] = await db.select({ reg: schema.vehicles.registration }).from(schema.vehicles).where(eq(schema.vehicles.id, id)).limit(1);
  if (!v) redirect('/fleet');
  const used = await db.execute(sql`
    select (select count(*)::int from bigventures.trips where vehicle_id = ${id})
         + (select count(*)::int from bigventures.fuel_entries where vehicle_id = ${id})
         + (select count(*)::int from bigventures.cost_entries where vehicle_id = ${id})
         + (select count(*)::int from bigventures.invoice_lines where vehicle_id = ${id}) as n`);
  if (Number((used.rows[0] as { n: number }).n) > 0) {
    back(`${v!.reg} has trips or costs on record, so can't be deleted. Set its status to Sold or Inactive instead.`);
  }
  try {
    await db.delete(schema.vehicles).where(eq(schema.vehicles.id, id));
  } catch {
    back(`${v!.reg} has other records attached. Set its status to Sold or Inactive instead.`);
  }
  await writeAudit(actor, 'delete', 'vehicle', id, { registration: v!.reg }, null);
  revalidatePath('/fleet');
  redirect('/fleet');
}
