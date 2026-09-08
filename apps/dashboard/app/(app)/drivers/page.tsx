import { requirePermission } from '@/lib/session';
import { Placeholder } from '@/components/Placeholder';

export default async function Page() {
  await requirePermission('driver:read');
  return <Placeholder title="Drivers" phase="Phase 1 · profiles + compliance" what="Driver roster with licence & document expiry, advance balance and quality score" />;
}
