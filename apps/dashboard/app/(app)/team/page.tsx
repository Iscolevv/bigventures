import { requirePermission, can } from '@/lib/session';
import { db, schema, ne } from '@bv/db';
import { PageHeader, Card, Badge } from '@/components/ui';
import { addOfficeUser, updateOfficeUser } from './actions';

export const dynamic = 'force-dynamic';
const input = 'mt-1 w-full rounded-md border bg-surface px-3 py-2 text-sm';

const ROLE_LABEL: Record<string, string> = {
  admin: 'Super admin (manages everything)',
  operations: 'Operations',
  management: 'Management (view + approve)',
};

export default async function TeamPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const me = await requirePermission('user:read');
  const canEdit = can(me.role, 'user:update');
  const { error } = await searchParams;
  const users = await db
    .select({ id: schema.user.id, name: schema.user.name, email: schema.user.email, role: schema.user.role, status: schema.user.status })
    .from(schema.user)
    .where(ne(schema.user.role, 'driver'))
    .orderBy(schema.user.name);

  return (
    <>
      <PageHeader title="Team" subtitle="Office logins. Drivers are managed on the Drivers page." />
      {error && <p className="mb-3 text-sm text-crit">{error}</p>}

      <div className="space-y-2">
        {users.map((u) => (
          <details key={u.id} className="rounded-xl border bg-surface">
            <summary className="flex cursor-pointer items-center justify-between gap-3 px-4 py-3 text-sm">
              <span>
                <span className="font-medium">{u.name}</span>
                <span className="ml-2 text-muted">{u.email}</span>
              </span>
              <span className="flex items-center gap-2">
                <Badge tone={u.role === 'admin' ? 'brand' : 'muted'}>{u.role}</Badge>
                {u.status !== 'active' && <Badge tone="crit">{u.status}</Badge>}
              </span>
            </summary>
            {canEdit && (
              <form action={updateOfficeUser} className="grid gap-3 border-t p-4 sm:grid-cols-[1fr_9rem_1fr_auto] sm:items-end">
                <input type="hidden" name="id" value={u.id} />
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
                <label className="text-sm font-medium">
                  New password (blank = keep)
                  <input name="password" type="text" minLength={8} className={input} autoComplete="off" />
                </label>
                <button className="rounded-md bg-brand px-4 py-2 text-sm font-semibold text-white">Save</button>
              </form>
            )}
          </details>
        ))}
      </div>

      {can(me.role, 'user:create') && (
        <Card title="Add an office login" className="mt-6 max-w-3xl">
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
    </>
  );
}
