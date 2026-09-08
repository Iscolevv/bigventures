import { requirePermission } from '@/lib/session';
import { Placeholder } from '@/components/Placeholder';

export default async function Page() {
  await requirePermission('invoice:read');
  return <Placeholder title="Invoicing" phase="Phase 3" what="Auto-generated invoice lines from delivered trips with valid POD, and payment status" />;
}
