'use server';
import { revalidatePath } from 'next/cache';
import { requirePermission } from '@/lib/session';
import { writeAudit } from '@/lib/audit';
import { db, schema, eq, sql, and } from '@bv/db';

/**
 * Draft an invoice for every unbilled delivered trip of one client, priced off
 * the client's current rate. Flags the invoice if any linked trip still has an
 * unresolved delivery issue.
 */
export async function generateInvoiceForClient(clientId: string) {
  const user = await requirePermission('invoice:create');

  const [client] = await db.select().from(schema.clients).where(eq(schema.clients.id, clientId)).limit(1);
  if (!client) return { error: 'Client not found' };
  const [rate] = await db
    .select()
    .from(schema.clientRates)
    .where(eq(schema.clientRates.client_id, clientId))
    .limit(1);
  if (!rate) return { error: 'No rate card for this client' };

  const unbilled = await db
    .select({
      id: schema.trips.id,
      ref: schema.trips.reference_code,
      delivered: sql<number>`(select count(*)::int from bigventures.drops d where d.trip_id = ${schema.trips.id} and d.status in ('delivered','partial'))`,
      issues: sql<number>`(select count(*)::int from bigventures.drops d where d.trip_id = ${schema.trips.id} and d.issue_category is not null)`,
    })
    .from(schema.trips)
    .where(
      and(
        eq(schema.trips.client_id, clientId),
        eq(schema.trips.status, 'completed'),
        sql`not exists (select 1 from bigventures.invoice_lines il where il.trip_id = ${schema.trips.id})`,
        sql`exists (select 1 from bigventures.drops d where d.trip_id = ${schema.trips.id} and d.status = 'delivered')`,
      ),
    );

  if (unbilled.length === 0) return { error: 'Nothing to invoice for this client' };

  const [{ n } = { n: 1000 }] = await db
    .select({ n: sql<number>`coalesce(max(cast(split_part(${schema.invoices.invoice_number}, '-', 3) as int)), 1000)::int` })
    .from(schema.invoices);
  const invId = crypto.randomUUID();
  const issue = new Date();
  const due = new Date(issue.getTime() + client.payment_terms_days * 86_400_000);
  const perTrip = rate.rate_type === 'per_trip';
  const unit = Number(rate.amount);

  let subtotal = 0;
  const lines = unbilled.map((t) => {
    const qty = perTrip ? 1 : Math.max(1, t.delivered);
    const lineTotal = qty * unit;
    subtotal += lineTotal;
    return {
      invoice_id: invId,
      trip_id: t.id,
      description: perTrip ? `Consignment ${t.ref}` : `${t.ref} — ${qty} drop(s)`,
      quantity: String(qty),
      unit_amount: String(unit),
      line_total: String(lineTotal),
    };
  });
  const hasIssues = unbilled.some((t) => t.issues > 0);
  const tax = subtotal * 0.16;

  await db.insert(schema.invoices).values({
    id: invId,
    invoice_number: `BV-2026-${n + 1}`,
    client_id: clientId,
    status: 'draft',
    issue_date: issue.toISOString().slice(0, 10),
    due_date: due.toISOString().slice(0, 10),
    subtotal: String(subtotal),
    tax: String(tax),
    total: String(subtotal + tax),
    has_unresolved_issues: hasIssues,
    created_by: user.id,
  });
  await db.insert(schema.invoiceLines).values(lines);
  await writeAudit(user, 'create', 'invoice', invId, null, { lines: lines.length, total: subtotal + tax });
  revalidatePath('/invoicing');
  return { ok: true, lines: lines.length, total: subtotal + tax, flagged: hasIssues };
}

export async function setInvoiceStatus(invoiceId: string, status: 'issued' | 'paid' | 'void') {
  const user = await requirePermission('invoice:update');
  const patch: Record<string, unknown> = { status, updated_at: new Date() };
  if (status === 'paid') {
    const [inv] = await db.select().from(schema.invoices).where(eq(schema.invoices.id, invoiceId)).limit(1);
    if (inv) patch.amount_paid = inv.total;
  }
  await db.update(schema.invoices).set(patch).where(eq(schema.invoices.id, invoiceId));
  await writeAudit(user, 'update', 'invoice', invoiceId, null, { status });
  revalidatePath('/invoicing');
  return { ok: true };
}
