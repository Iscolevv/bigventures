'use server';
import { revalidatePath } from 'next/cache';
import { requirePermission } from '@/lib/session';
import { writeAudit } from '@/lib/audit';
import { db, schema, eq } from '@bv/db';

export async function saveSettings(form: {
  companyName: string;
  companyKraPin: string;
  invoiceTaxPct: string;
  invoicePrefix: string;
  tripPrefix: string;
}) {
  const user = await requirePermission('settings:update');
  const tax = Number(form.invoiceTaxPct);
  if (Number.isNaN(tax) || tax < 0 || tax > 100) return { error: 'Tax % must be 0–100' };

  await db
    .insert(schema.settings)
    .values({
      key: 'default',
      company_name: form.companyName.trim() || 'Big Ventures',
      company_kra_pin: form.companyKraPin.trim() || null,
      invoice_tax_pct: String(tax),
      invoice_prefix: form.invoicePrefix.trim() || 'BV',
      trip_prefix: form.tripPrefix.trim() || 'TRP',
      updated_by: user.id,
      updated_at: new Date(),
    })
    .onConflictDoUpdate({
      target: schema.settings.key,
      set: {
        company_name: form.companyName.trim() || 'Big Ventures',
        company_kra_pin: form.companyKraPin.trim() || null,
        invoice_tax_pct: String(tax),
        invoice_prefix: form.invoicePrefix.trim() || 'BV',
        trip_prefix: form.tripPrefix.trim() || 'TRP',
        updated_by: user.id,
        updated_at: new Date(),
      },
    });
  await writeAudit(user, 'update', 'settings', 'default', null, form);
  revalidatePath('/settings');
  return { ok: true };
}
