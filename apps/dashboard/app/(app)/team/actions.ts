'use server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { requirePermission } from '@/lib/session';
import { writeAudit } from '@/lib/audit';
import { db, schema, eq, sql } from '@bv/db';
import { createLogin, setLoginPassword, isValidEmail } from '@/lib/people';

const OFFICE_ROLES = ['admin', 'operations', 'management'] as const;
const fail = (m: string): never => redirect(`/team?error=${encodeURIComponent(m)}`);
const ok = (m: string): never => redirect(`/team?msg=${encodeURIComponent(m)}`);

export async function addOfficeUser(form: FormData) {
  const actor = await requirePermission('user:create');
  const name = String(form.get('name') ?? '').trim();
  const email = String(form.get('email') ?? '').trim().toLowerCase();
  const role = String(form.get('role') ?? 'admin');
  const password = String(form.get('password') ?? '');
  if (!name || !email) fail('Name and email are required');
  if (!isValidEmail(email)) fail("Enter the full email address, like name@company.com - a login without one can't sign in");
  if (!(OFFICE_ROLES as readonly string[]).includes(role)) fail('Pick a role');
  if (password.length < 8) fail('Password must be at least 8 characters');
  try {
    const id = await createLogin({ name, email, role: role as 'admin', password });
    await writeAudit(actor, 'create', 'user', id, null, { name, email, role });
  } catch {
    fail('That email already has a login');
  }
  revalidatePath('/team');
  ok('Login added');
}

export async function updateOfficeUser(form: FormData) {
  const actor = await requirePermission('user:update');
  const id = String(form.get('id') ?? '');
  const name = String(form.get('name') ?? '').trim();
  const role = String(form.get('role') ?? '');
  const status = String(form.get('status') ?? 'active');
  const password = String(form.get('password') ?? '');
  const email = String(form.get('email') ?? '').trim().toLowerCase();
  if (!name) fail('Name is required');
  if (!(OFFICE_ROLES as readonly string[]).includes(role)) fail('Pick a role');
  if (!isValidEmail(email)) fail("Enter the full email address, like name@company.com - a login without one can't sign in");
  if (id === actor.id && (role !== actor.role || status !== 'active')) fail("You can't change your own role or suspend yourself");
  if (password && password.length < 8) fail('Password must be at least 8 characters');

  try {
    await db
      .update(schema.user)
      .set({ name, email, role: role as 'admin', status: status === 'suspended' ? 'suspended' : 'active', updatedAt: new Date() })
      .where(eq(schema.user.id, id));
  } catch {
    fail('That email already has a login');
  }
  if (password) await setLoginPassword(id, password);
  await writeAudit(actor, 'update', 'user', id, null, { name, email, role, status, passwordReset: !!password });
  revalidatePath('/team');
  ok('Saved');
}

/** Remove an office login. Never yourself, never the last admin. */
export async function deleteOfficeUser(form: FormData) {
  const actor = await requirePermission('user:delete');
  const id = String(form.get('id') ?? '');
  if (id === actor.id) fail("You can't remove your own login");

  const [target] = await db.select({ role: schema.user.role, name: schema.user.name }).from(schema.user).where(eq(schema.user.id, id)).limit(1);
  if (!target || target.role === 'driver') fail('That login was not found');
  if (target!.role === 'admin') {
    const [{ n } = { n: 0 }] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(schema.user)
      .where(sql`${schema.user.role} = 'admin' and ${schema.user.status} = 'active'`);
    if (n <= 1) fail('There must always be at least one active admin');
  }
  try {
    await db.execute(sql`delete from bigventures.session where "userId" = ${id}`);
    await db.execute(sql`delete from bigventures.account where "userId" = ${id}`);
    await db.delete(schema.user).where(eq(schema.user.id, id));
  } catch {
    fail(`${target!.name} has recorded activity, so the login can't be deleted. Suspend it instead.`);
  }
  await writeAudit(actor, 'delete', 'user', id, { name: target!.name }, null);
  revalidatePath('/team');
  ok(`${target!.name} removed`);
}
