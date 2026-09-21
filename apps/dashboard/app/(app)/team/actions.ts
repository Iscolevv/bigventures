'use server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { requirePermission } from '@/lib/session';
import { writeAudit } from '@/lib/audit';
import { db, schema, eq } from '@bv/db';
import { createLogin, setLoginPassword } from '@/lib/people';

const OFFICE_ROLES = ['admin', 'operations', 'management'] as const;
const fail = (m: string): never => redirect(`/team?error=${encodeURIComponent(m)}`);

export async function addOfficeUser(form: FormData) {
  const actor = await requirePermission('user:create');
  const name = String(form.get('name') ?? '').trim();
  const email = String(form.get('email') ?? '').trim().toLowerCase();
  const role = String(form.get('role') ?? 'admin');
  const password = String(form.get('password') ?? '');
  if (!name || !email) fail('Name and email are required');
  if (!(OFFICE_ROLES as readonly string[]).includes(role)) fail('Pick a role');
  if (password.length < 8) fail('Password must be at least 8 characters');
  try {
    const id = await createLogin({ name, email, role: role as 'admin', password });
    await writeAudit(actor, 'create', 'user', id, null, { name, email, role });
  } catch {
    fail('That email already has a login');
  }
  revalidatePath('/team');
  redirect('/team');
}

export async function updateOfficeUser(form: FormData) {
  const actor = await requirePermission('user:update');
  const id = String(form.get('id') ?? '');
  const role = String(form.get('role') ?? '');
  const status = String(form.get('status') ?? 'active');
  const password = String(form.get('password') ?? '');
  const email = String(form.get('email') ?? '').trim().toLowerCase();
  if (!(OFFICE_ROLES as readonly string[]).includes(role)) fail('Pick a role');
  if (!email.includes('@')) fail('Enter a valid email');
  if (id === actor.id && (role !== actor.role || status !== 'active')) fail("You can't change your own role or suspend yourself");
  if (password && password.length < 8) fail('Password must be at least 8 characters');

  try {
    await db
      .update(schema.user)
      .set({ email, role: role as 'admin', status: status === 'suspended' ? 'suspended' : 'active', updatedAt: new Date() })
      .where(eq(schema.user.id, id));
  } catch {
    fail('That email already has a login');
  }
  if (password) await setLoginPassword(id, password);
  await writeAudit(actor, 'update', 'user', id, null, { email, role, status, passwordReset: !!password });
  revalidatePath('/team');
  redirect('/team');
}
