import { requirePermission } from '@/lib/session';
import { Placeholder } from '@/components/Placeholder';

export default async function Page() {
  await requirePermission('fuel:read');
  return <Placeholder title="Fuel & consumption" phase="Phase 1 · consumption / Phase 3 · anomaly alerts" what="Litres per 100km per vehicle, cost trends and consumption anomaly flags" />;
}
