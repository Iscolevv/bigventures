'use server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { requirePermission } from '@/lib/session';
import { writeAudit } from '@/lib/audit';
import { db, schema, eq, sql } from '@bv/db';
import { COST_CATEGORIES, ADVANCE_DIRECTIONS, PAYMENT_METHODS } from '@bv/core/enums';

const back = (m: string): never => redirect(`/costs?error=${encodeURIComponent(m)}`);
const ok = (m: string): never => redirect(`/costs?msg=${encodeURIComponent(m)}`);

export async function addCost(form: FormData) {
  const user = await requirePermission('cost:create');
  const category = String(form.get('category') ?? '');
  const amount = Number(form.get('amount'));
  const date = String(form.get('date') ?? '') || new Date().toISOString().slice(0, 10);
  const vehicleId = String(form.get('vehicleId') ?? '') || null;
  const driverId = String(form.get('driverId') ?? '') || null;
  const description = String(form.get('description') ?? '').trim() || null;
  const vendor = String(form.get('vendor') ?? '').trim() || null;
  if (!(COST_CATEGORIES as readonly string[]).includes(category)) back('Pick a category');
  if (!(amount > 0)) back('Enter the amount (Ksh)');

  const [row] = await db
    .insert(schema.costEntries)
    .values({
      category: category as 'repair',
      amount: String(amount),
      incurred_at: date,
      vehicle_id: vehicleId,
      driver_id: driverId,
      description,
      vendor,
      status: 'approved',
      approved_by: user.id,
      approved_at: new Date(),
      source: 'dashboard',
      created_by: user.id,
    })
    .returning({ id: schema.costEntries.id });
  await writeAudit(user, 'create', 'cost', row!.id, null, { category, amount, date, vehicleId });
  revalidatePath('/costs');
  ok('Cost recorded');
}

export async function deleteCost(form: FormData) {
  const user = await requirePermission('cost:delete');
  const id = String(form.get('id') ?? '');
  await db.delete(schema.costEntries).where(eq(schema.costEntries.id, id));
  await writeAudit(user, 'delete', 'cost', id, null, null);
  revalidatePath('/costs');
  ok('Cost removed');
}

/** advance given = balance goes up; repaid / written off = goes down. */
export async function addAdvance(form: FormData) {
  const user = await requirePermission('advance:create');
  const driverId = String(form.get('driverId') ?? '');
  const direction = String(form.get('direction') ?? 'disbursed');
  const amount = Number(form.get('amount'));
  const date = String(form.get('date') ?? '') || new Date().toISOString().slice(0, 10);
  const method = String(form.get('method') ?? '');
  const description = String(form.get('description') ?? '').trim() || null;
  if (!driverId) back('Pick a driver');
  if (!(ADVANCE_DIRECTIONS as readonly string[]).includes(direction)) back('Pick what happened');
  if (!(amount > 0)) back('Enter the amount (Ksh)');

  const [row] = await db
    .insert(schema.advances)
    .values({
      driver_id: driverId,
      amount: String(amount),
      direction: direction as 'disbursed',
      issued_at: date,
      method: (PAYMENT_METHODS as readonly string[]).includes(method) ? (method as 'mpesa') : null,
      description,
      created_by: user.id,
    })
    .returning({ id: schema.advances.id });
  const delta = direction === 'disbursed' ? amount : -amount;
  await db.execute(sql`update bigventures.drivers set advance_balance = greatest(0, advance_balance + ${delta}) where id = ${driverId}`);
  await writeAudit(user, 'create', 'advance', row!.id, null, { driverId, direction, amount });
  revalidatePath('/costs');
  ok('Recorded');
}

export async function deleteAdvance(form: FormData) {
  const user = await requirePermission('advance:delete');
  const id = String(form.get('id') ?? '');
  const [a] = await db.select().from(schema.advances).where(eq(schema.advances.id, id)).limit(1);
  if (!a) back('Entry not found');
  const delta = a!.direction === 'disbursed' ? -Number(a!.amount) : Number(a!.amount);
  await db.delete(schema.advances).where(eq(schema.advances.id, id));
  await db.execute(sql`update bigventures.drivers set advance_balance = greatest(0, advance_balance + ${delta}) where id = ${a!.driver_id}`);
  await writeAudit(user, 'delete', 'advance', id, null, null);
  revalidatePath('/costs');
  ok('Entry removed');
}
