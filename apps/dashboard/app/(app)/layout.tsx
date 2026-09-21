import { requireDashboardUser, can } from '@/lib/session';
import { db } from '@bv/db';
import { pendingApprovalCount } from '@bv/db/queries';
import { Sidebar } from '@/components/Sidebar';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireDashboardUser();
  const pending = can(user.role, 'trip:approve') ? await pendingApprovalCount(db) : 0;
  return (
    <div className="flex min-h-[100dvh] flex-col lg:flex-row">
      <Sidebar role={user.role} name={user.name} pendingApprovals={pending} />
      <main className="min-w-0 flex-1 overflow-x-hidden p-4 lg:p-6">{children}</main>
    </div>
  );
}
