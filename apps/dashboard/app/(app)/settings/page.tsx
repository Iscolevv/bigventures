import { requirePermission } from '@/lib/session';
import { db, schema, eq } from '@bv/db';
import { PageHeader, Card } from '@/components/ui';
import { SettingsForm } from '@/components/SettingsForm';
import { ChangePassword } from '@/components/ChangePassword';

export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
  await requirePermission('settings:read');
  const [row] = await db.select().from(schema.settings).where(eq(schema.settings.key, 'default')).limit(1);

  return (
    <>
      <PageHeader title="Settings" subtitle="Company details used across invoices, exports and alerts" />
      <Card title="Company">
        <SettingsForm
          initial={{
            companyName: row?.company_name ?? 'Big Ventures',
            companyKraPin: row?.company_kra_pin ?? '',
            invoiceTaxPct: row?.invoice_tax_pct ?? '16',
            invoicePrefix: row?.invoice_prefix ?? 'BV',
            tripPrefix: row?.trip_prefix ?? 'TRP',
          }}
        />
      </Card>
      <Card title="Your password" className="mt-4">
        <ChangePassword />
      </Card>
    </>
  );
}
