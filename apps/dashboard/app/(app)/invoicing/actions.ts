'use server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { requirePermission } from '@/lib/session';
import { writeAudit } from '@/lib/audit';
import { db, schema, eq, sql, and } from '@bv/db';
import { PAYMENT_METHODS } from '@bv/core/enums';

async function taxPct(): Promise<number> {
  const [s] = await db.select({ t: schema.settings.invoice_tax_pct }).from(schema.settings).where(eq(schema.settings.key, 'default')).limit(1);
  const n = Number(s?.t ?? 16);
  return Number.isFinite(n) ? n : 16;
}

async function nextInvoiceNumber(): Promise<string> {
  const [{ n } = { n: 1000 }] = await db
    .select({ n: sql<number>`coalesce(max(cast(nullif(split_part(${schema.invoices.invoice_number}, '-', 3), '') as int)), 1000)::int` })
    .from(schema.invoices);
  return `BV-${new Date().getUTCFullYear()}-${n + 1}`;
}

/**
 * Draft an invoice for every approved, unbilled trip of one client, priced at the
 * amount the office set on each trip. Flags the invoice if any linked trip still
 * has an unresolved delivery issue.
 */
export async function generateInvoiceForClient(clientId: string) {
  const user = await requirePermission('invoice:create');

  const [client] = await db.select().from(schema.clients).where(eq(schema.clients.id, clientId)).limit(1);
  if (!client) return { error: 'Client not found' };

  const unbilled = await db
    .select({
      id: schema.trips.id,
      ref: schema.trips.reference_code,
      billed: schema.trips.billed_amount,
      stops: sql<number>`(select count(*)::int from bigventures.drops d where d.trip_id = bigventures.trips.id and d.status in ('delivered','partial'))`,
      issues: sql<number>`(select count(*)::int from bigventures.drops d where d.trip_id = bigventures.trips.id and d.issue_category is not null)`,
    })
    .from(schema.trips)
    .where(
      and(
        eq(schema.trips.client_id, clientId),
        eq(schema.trips.status, 'completed'),
        sql`not exists (select 1 from bigventures.invoice_lines il where il.trip_id = bigventures.trips.id)`,
        sql`exists (select 1 from bigventures.drops d where d.trip_id = bigventures.trips.id and d.status in ('delivered','partial'))`,
      ),
    );

  if (unbilled.length === 0) return { error: 'Nothing to invoice for this client' };
  const priced = unbilled.filter((t) => t.billed != null && Number(t.billed) > 0);
  if (priced.length === 0) {
    return { error: `${unbilled.length} trip(s) have no amount yet. Open the trip and set what to bill.` };
  }

  const invId = crypto.randomUUID();
  const issue = new Date();
  const due = new Date(issue.getTime() + client.payment_terms_days * 86_400_000);

  let subtotal = 0;
  const lines = priced.map((t) => {
    const amount = Number(t.billed);
    subtotal += amount;
    return {
      invoice_id: invId,
      trip_id: t.id,
      description: `${t.ref} - ${t.stops} stop${t.stops === 1 ? '' : 's'}`,
      quantity: '1',
      unit_amount: String(amount),
      line_total: String(amount),
    };
  });
  const hasIssues = priced.some((t) => t.issues > 0);
  const tax = Math.round(subtotal * (await taxPct())) / 100;

  await db.insert(schema.invoices).values({
    id: invId,
    invoice_number: await nextInvoiceNumber(),
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
  const skipped = unbilled.length - priced.length;
  return { ok: true, lines: lines.length, total: subtotal + tax, flagged: hasIssues, skipped };
}

/** An invoice for anything that isn't a logged trip (storage, demurrage, a one-off haul...). */
export async function createManualInvoice(form: FormData) {
  const user = await requirePermission('invoice:create');
  const clientId = String(form.get('clientId') ?? '');
  const description = String(form.get('description') ?? '').trim();
  const qty = Number(form.get('quantity') ?? 1);
  const unit = Number(form.get('unit'));
  const back = (m: string): never => redirect(`/invoicing?error=${encodeURIComponent(m)}`);

  if (!clientId) back('Pick a client');
  if (!description) back('Describe what the invoice is for');
  if (!(qty > 0) || !(unit > 0)) back('Quantity and amount must be more than zero');

  const [client] = await db.select().from(schema.clients).where(eq(schema.clients.id, clientId)).limit(1);
  if (!client) back('Client not found');

  const subtotal = qty * unit;
  const tax = Math.round(subtotal * (await taxPct())) / 100;
  const issue = new Date();
  const due = new Date(issue.getTime() + client!.payment_terms_days * 86_400_000);
  const invId = crypto.randomUUID();
  await db.insert(schema.invoices).values({
    id: invId,
    invoice_number: await nextInvoiceNumber(),
    client_id: clientId,
    status: 'issued',
    issue_date: issue.toISOString().slice(0, 10),
    due_date: due.toISOString().slice(0, 10),
    subtotal: String(subtotal),
    tax: String(tax),
    total: String(subtotal + tax),
    created_by: user.id,
  });
  await db.insert(schema.invoiceLines).values({
    invoice_id: invId,
    description,
    quantity: String(qty),
    unit_amount: String(unit),
    line_total: String(subtotal),
  });
  await writeAudit(user, 'create', 'invoice', invId, null, { manual: true, total: subtotal + tax });
  revalidatePath('/invoicing');
  redirect('/invoicing?msg=' + encodeURIComponent('Invoice created and issued'));
}

/** Record money received against an invoice; the invoice becomes part paid / paid automatically. */
export async function recordPayment(form: FormData) {
  const user = await requirePermission('payment:create');
  const invoiceId = String(form.get('invoiceId') ?? '');
  const amount = Number(form.get('amount'));
  const paidAt = String(form.get('paidAt') ?? '') || new Date().toISOString().slice(0, 10);
  const method = String(form.get('method') ?? '');
  const reference = String(form.get('reference') ?? '').trim() || null;
  const back = (m: string): never => redirect(`/invoicing?error=${encodeURIComponent(m)}`);

  if (!(amount > 0)) back('Enter the amount received');
  const [inv] = await db.select().from(schema.invoices).where(eq(schema.invoices.id, invoiceId)).limit(1);
  if (!inv) back('Invoice not found');
  const total = Number(inv!.total);
  const paidSoFar = Number(inv!.amount_paid);
  if (amount > total - paidSoFar + 0.005) back(`That is more than the ${Math.round(total - paidSoFar).toLocaleString()} still owed`);

  await db.insert(schema.payments).values({
    invoice_id: invoiceId,
    amount: String(amount),
    paid_at: paidAt,
    method: (PAYMENT_METHODS as readonly string[]).includes(method) ? (method as 'mpesa') : null,
    reference,
    recorded_by: user.id,
  });
  const newPaid = paidSoFar + amount;
  await db
    .update(schema.invoices)
    .set({ amount_paid: String(newPaid), status: newPaid >= total - 0.005 ? 'paid' : 'part_paid', updated_at: new Date() })
    .where(eq(schema.invoices.id, invoiceId));
  await writeAudit(user, 'create', 'payment', invoiceId, null, { amount, paidAt, method, reference });
  revalidatePath('/invoicing');
  redirect('/invoicing?msg=' + encodeURIComponent('Payment recorded'));
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
