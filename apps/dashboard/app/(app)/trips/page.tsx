import { requirePermission } from '@/lib/session';
import { Placeholder } from '@/components/Placeholder';

export default async function Page() {
  await requirePermission('trip:read');
  return <Placeholder title="Trips" phase="Phase 1 · trip log / Phase 2 · route map" what="Searchable trip log with expected-vs-actual route map per trip" />;
}
