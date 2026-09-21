'use server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { requirePermission } from '@/lib/session';
import { writeAudit } from '@/lib/audit';
import { db, schema, eq } from '@bv/db';

export async function saveClient(form: FormData) {
  const id = String(form.get('id') ?? '');
  const user = await requirePermission(id ? 'client:update' : 'client:create');
  const name = String(form.get('name') ?? '').trim();
  const contact = String(form.get('contact_name') ?? '').trim() || null;
  const terms = Math.max(0, Math.min(365, Number(form.get('payment_terms_days') ?? 30) || 30));
  const active = form.get('active') !== 'off';
  if (!name) redirect(`/clients?error=${encodeURIComponent('Client name is required')}`);

  const values = { name, contact_name: contact, payment_terms_days: terms, active };
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
