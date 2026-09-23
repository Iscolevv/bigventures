'use server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { requirePermission } from '@/lib/session';
import { writeAudit } from '@/lib/audit';
import { db, schema, eq, sql } from '@bv/db';

export async function saveClient(form: FormData) {
  const id = String(form.get('id') ?? '');
  const user = await requirePermission(id ? 'client:update' : 'client:create');
  const name = String(form.get('name') ?? '').trim();
  const contact = String(form.get('contact_name') ?? '').trim() || null;
  const terms = Math.max(0, Math.min(365, Number(form.get('payment_terms_days') ?? 30) || 30));
  const active = form.get('active') !== 'off';
  const rateRaw = String(form.get('default_trip_rate') ?? '').trim();
  const rate = rateRaw && Number(rateRaw) >= 0 ? String(Number(rateRaw)) : null;
  if (!name) redirect(`/clients?error=${encodeURIComponent('Client name is required')}`);

  const values = { name, contact_name: contact, payment_terms_days: terms, default_trip_rate: rate, active };
  if (id) {
    await db.update(schema.clients).set({ ...values, updated_at: new Date() }).where(eq(schema.clients.id, id));
    await writeAudit(user, 'update', 'client', id, null, values);
  } else {
    const [row] = await db.insert(schema.clients).values(values).returning({ id: schema.clients.id });
    await writeAudit(user, 'create', 'client', row!.id, null, values);
  }
  revalidatePath('/clients');
  redirect('/clients');
}

/** Remove a client with no invoices or trips. Otherwise mark them Inactive so history stays intact. */
export async function deleteClient(form: FormData) {
  const actor = await requirePermission('client:delete');
  const id = String(form.get('id') ?? '');
  const back = (m: string): never => redirect(`/clients?error=${encodeURIComponent(m)}`);

  const [c] = await db.select({ name: schema.clients.name }).from(schema.clients).where(eq(schema.clients.id, id)).limit(1);
  if (!c) redirect('/clients');
  const used = await db.execute(sql`
    select (select count(*)::int from bigventures.invoices where client_id = ${id})
         + (select count(*)::int from bigventures.trips where client_id = ${id}) as n`);
  if (Number((used.rows[0] as { n: number }).n) > 0) back(`${c!.name} has invoices or trips on record, so can't be deleted. Mark them Inactive instead.`);
  try {
    await db.delete(schema.clients).where(eq(schema.clients.id, id));
  } catch {
    back(`${c!.name} has other records attached. Mark them Inactive instead.`);
  }
  await writeAudit(actor, 'delete', 'client', id, { name: c!.name }, null);
  revalidatePath('/clients');
  redirect('/clients?msg=' + encodeURIComponent(`${c!.name} removed`));
}
