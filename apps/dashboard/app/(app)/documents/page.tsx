import { requirePermission } from '@/lib/session';
import { Placeholder } from '@/components/Placeholder';

export default async function Page() {
  await requirePermission('document:read');
  return <Placeholder title="Documents" phase="Phase 1" what="Central repository for driver, vehicle and company documents with expiry tracking" />;
}
