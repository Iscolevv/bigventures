import { requirePermission } from '@/lib/session';
import { Placeholder } from '@/components/Placeholder';

export default async function Page() {
  await requirePermission('alert:read');
  return <Placeholder title="Alerts & exceptions" phase="Phase 3" what="Failed checks, delivery issues, fuel anomalies, document expiries and overdue advances in one panel" />;
}
