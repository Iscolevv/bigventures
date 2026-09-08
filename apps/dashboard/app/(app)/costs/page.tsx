import { requirePermission } from '@/lib/session';
import { Placeholder } from '@/components/Placeholder';

export default async function Page() {
  await requirePermission('cost:read');
  return <Placeholder title="Costs & advances" phase="Phase 2" what="Repairs, service, parking, fines and driver advances with running totals" />;
}
