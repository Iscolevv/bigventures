import Link from 'next/link';
import { requirePermission, can } from '@/lib/session';
import { db, schema, eq, ne } from '@bv/db';
import { PageHeader, Card, Badge } from '@/components/ui';
import { ConfirmSubmit } from '@/components/ConfirmSubmit';
import { addOfficeUser, updateOfficeUser, deleteOfficeUser } from './actions';

export const dynamic = 'force-dynamic';
const input = 'mt-1 w-full rounded-md border bg-surface px-3 py-2 text-sm';

const ROLE_LABEL: Record<string, string> = {
  admin: 'Super admin (manages everything)',
  operations: 'Operations',
  management: 'Management (view + approve)',
};

export default async function TeamPage({ searchParams }: { searchParams: Promise<{ error?: string; msg?: string }> }) {
  const me = await requirePermission('user:read');
  const canEdit = can(me.role, 'user:update');
  const canDelete = can(me.role, 'user:delete');
  const { error, msg } = await searchParams;

  const [office, drivers] = await Promise.all([
    db
      .select({ id: schema.user.id, name: schema.user.name, email: schema.user.email, role: schema.user.role, status: schema.user.status })
      .from(schema.user)
      .where(ne(schema.user.role, 'driver'))
      .orderBy(schema.user.name),
    db
      .select({ id: schema.drivers.id, name: schema.drivers.full_name, email: schema.user.email, status: schema.drivers.status })
      .from(schema.drivers)
      .leftJoin(schema.user, eq(schema.user.id, schema.drivers.user_id))
      .orderBy(schema.drivers.full_name),
  ]);

  return (
    <>
      <PageHeader title="Team & logins" subtitle="Everyone who can sign in. Admins can rename, change roles, reset passwords, suspend or remove anyone here." />
      {msg && <p className="mb-3 rounded-lg border border-ok/40 bg-ok/10 px-3 py-2 text-sm text-ok">{msg}</p>}
      {error && <p className="mb-3 rounded-lg border border-crit/40 bg-crit/10 px-3 py-2 text-sm text-crit">{error}</p>}

      <h2 className="mb-2 text-sm font-semibold">Office</h2>
      <div className="space-y-2">
        {office.map((u) => (
          <details key={u.id} className="rounded-xl border bg-surface">
            <summary className="flex cursor-pointer items-center justify-between gap-3 px-4 py-3 text-sm">
              <span>
                <span className="font-medium">{u.name}</span>
                <span className="ml-2 text-muted">{u.email}</span>
                {u.id === me.id && <span className="ml-2 text-xs text-muted">(you)</span>}
              </span>
              <span className="flex items-center gap-2">
                <Badge tone={u.role === 'admin' ? 'brand' : 'muted'}>{u.role}</Badge>
                {u.status !== 'active' && <Badge tone="crit">{u.status}</Badge>}
              </span>
            </summary>
            {canEdit && (
              <div className="border-t p-4">
                <form action={updateOfficeUser} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  <input type="hidden" name="id" value={u.id} />
                  <label className="text-sm font-medium">
                    Name
                    <input name="name" required defaultValue={u.name} className={input} />
                  </label>
                  <label className="text-sm font-medium">
                    Email (approval emails go here)
                    <input name="email" type="email" required defaultValue={u.email} className={input} />
                  </label>
                  <label className="text-sm font-medium">
                    New password (blank = keep)
                    <input name="password" type="text" minLength={8} className={input} autoComplete="off" />
                  </label>
                  <label className="text-sm font-medium">
                    Role
                    <select name="role" defaultValue={u.role} className={input}>
                      {Object.entries(ROLE_LABEL).map(([k, v]) => (
                        <option key={k} value={k}>{v}</option>
                      ))}
                    </select>
                  </label>
                  <label className="text-sm font-medium">
                    Access
                    <select name="status" defaultValue={u.status === 'suspended' ? 'suspended' : 'active'} className={input}>
                      <option value="active">Active</option>
                      <option value="suspended">Suspended</option>
                    </select>
                  </label>
                  <div className="flex items-end">
                    <button className="rounded-md bg-brand px-4 py-2 text-sm font-semibold text-white">Save</button>
                  </div>
                </form>
                {canDelete && u.id !== me.id && (
                  <form action={deleteOfficeUser} className="mt-3 border-t pt-3">
                    <input type="hidden" name="id" value={u.id} />
                    <ConfirmSubmit message={`Remove ${u.name}'s login? They will no longer be able to sign in.`} className="text-sm text-crit hover:underline">
                      Remove this login
                    </ConfirmSubmit>
                  </form>
                )}
              </div>
            )}
          </details>
        ))}
      </div>

      {can(me.role, 'user:create') && (
        <Card title="Add an office login" className="mt-4 max-w-3xl">
          <form action={addOfficeUser} className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm font-medium">
              Name
              <input name="name" required className={input} />
            </label>
            <label className="text-sm font-medium">
              Email
              <input name="email" type="email" required className={input} />
            </label>
            <label className="text-sm font-medium">
              Role
              <select name="role" defaultValue="admin" className={input}>
                {Object.entries(ROLE_LABEL).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </label>
            <label className="text-sm font-medium">
              Starting password
              <input name="password" type="text" required minLength={8} className={input} autoComplete="off" />
            </label>
            <div>
              <button className="rounded-md bg-brand px-4 py-2 text-sm font-semibold text-white">Add login</button>
            </div>
          </form>
        </Card>
      )}

      <div className="mb-2 mt-8 flex items-center justify-between">
        <h2 className="text-sm font-semibold">Drivers ({drivers.length})</h2>
        {can(me.role, 'driver:create') && (
          <Link href="/drivers/new" className="text-sm font-medium text-brand hover:underline">+ Add driver</Link>
        )}
      </div>
      <Card className="p-0">
        <ul className="divide-y text-sm">
          {drivers.map((d) => (
            <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5">
              <span>
                <span className="font-medium">{d.name}</span>
                <span className="ml-2 text-muted">{d.email}</span>
              </span>
              <span className="flex items-center gap-3">
                <Badge tone={d.status === 'active' ? 'ok' : 'muted'}>{d.status.replace('_', ' ')}</Badge>
                {canEdit && (
                  <Link href={`/drivers/${d.id}`} className="text-brand hover:underline">Edit</Link>
                )}
              </span>
            </li>
          ))}
          {drivers.length === 0 && <li className="px-4 py-3 text-muted">No drivers yet.</li>}
        </ul>
      </Card>
    </>
  );
}
