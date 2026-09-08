import { requirePermission } from '@/lib/session';
import { Placeholder } from '@/components/Placeholder';

export default async function Page() {
  await requirePermission('payroll:read');
  return <Placeholder title="Incentives & payroll" phase="Phase 3" what="Trip counts, configurable payout tiers, quality score and payroll netting" />;
}
