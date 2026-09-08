import { requirePermission } from '@/lib/session';
import { Placeholder } from '@/components/Placeholder';

export default async function Page() {
  await requirePermission('report:read');
  return <Placeholder title="ROI & route analytics" phase="Phase 2" what="Revenue minus fuel, repairs and overhead per vehicle and per driver, plus route cost roll-ups" />;
}
