import { requirePermission, can } from '@/lib/session';
import { db, schema } from '@bv/db';
import { PageHeader, Card, Badge } from '@/components/ui';
import { saveClient, deleteClient } from './actions';
import { ConfirmSubmit } from '@/components/ConfirmSubmit';

export const dynamic = 'force-dynamic';
const input = 'mt-1 w-full rounded-md border bg-surface px-3 py-2 text-sm';

export default async function ClientsPage({ searchParams }: { searchParams: Promise<{ error?: string; msg?: string }> }) {
  const user = await requirePermission('client:read');
  const canEdit = can(user.role, 'client:update');
  const { error, msg } = await searchParams;
  const clients = await db.select().from(schema.clients).orderBy(schema.clients.name);

  return (
    <>
      <PageHeader title="Clients" subtitle="Who you deliver for and invoice" />
      {msg && <p className="mb-3 rounded-lg border border-ok/40 bg-ok/10 px-3 py-2 text-sm text-ok">{msg}</p>}
      {error && !canEdit && <p className="mb-3 text-sm text-crit">{error}</p>}
      {canEdit && (
        <Card title="Add a client" className="mb-4 max-w-2xl">
          <form action={saveClient} className="grid gap-3 sm:grid-cols-[1fr_1fr_8rem_9rem_auto] sm:items-end">
            <label className="text-sm font-medium">
              Name
              <input name="name" required className={input} placeholder="e.g. Ajab Flour Mills" />
            </label>
            <label className="text-sm font-medium">
              Contact (optional)
              <input name="contact_name" className={input} />
            </label>
            <label className="text-sm font-medium">
              Pays in (days)
              <input name="payment_terms_days" type="number" min={0} defaultValue={30} className={input} />
            </label>
            <label className="text-sm font-medium">
              Usual rate per trip (Ksh)
              <input name="default_trip_rate" inputMode="decimal" className={input} placeholder="optional" />
            </label>
            <button className="rounded-md bg-brand px-4 py-2 text-sm font-semibold text-white">Add</button>
          </form>
          {error && <p className="mt-2 text-sm text-crit">{error}</p>}
        </Card>
      )}

      <div className="space-y-2">
        {clients.map((c) => (
          <details key={c.id} className="rounded-xl border bg-surface">
            <summary className="flex cursor-pointer items-center justify-between gap-3 px-4 py-3 text-sm">
              <span className="font-medium">{c.name}</span>
              <span className="flex items-center gap-2 text-muted">
                {c.payment_terms_days} days
                <Badge tone={c.active ? 'ok' : 'muted'}>{c.active ? 'active' : 'inactive'}</Badge>
              </span>
            </summary>
            {canEdit && (
              <form action={saveClient} className="grid gap-3 border-t p-4 sm:grid-cols-[1fr_1fr_8rem_9rem_8rem_auto] sm:items-end">
                <input type="hidden" name="id" value={c.id} />
                <label className="text-sm font-medium">
                  Name
                  <input name="name" required defaultValue={c.name} className={input} />
                </label>
                <label className="text-sm font-medium">
                  Contact
                  <input name="contact_name" defaultValue={c.contact_name ?? ''} className={input} />
                </label>
                <label className="text-sm font-medium">
                  Pays in (days)
                  <input name="payment_terms_days" type="number" min={0} defaultValue={c.payment_terms_days} className={input} />
                </label>
                <label className="text-sm font-medium">
                  Usual rate per trip (Ksh)
                  <input name="default_trip_rate" inputMode="decimal" defaultValue={c.default_trip_rate ?? ''} className={input} />
                </label>
                <label className="text-sm font-medium">
                  Status
                  <select name="active" defaultValue={c.active ? 'on' : 'off'} className={input}>
                    <option value="on">Active</option>
                    <option value="off">Inactive</option>
                  </select>
                </label>
                <button className="rounded-md bg-brand px-4 py-2 text-sm font-semibold text-white">Save</button>
              </form>
            )}
            {canEdit && (
              <form action={deleteClient} className="border-t px-4 py-3">
                <input type="hidden" name="id" value={c.id} />
                <ConfirmSubmit message={'Delete ' + c.name + '? Only possible if they have no invoices or trips.'} className="text-sm text-crit hover:underline">
                  Delete this client
                </ConfirmSubmit>
              </form>
            )}
          </details>
        ))}
        {clients.length === 0 && <p className="text-sm text-muted">No clients yet. Add the first one above.</p>}
      </div>
    </>
  );
}
