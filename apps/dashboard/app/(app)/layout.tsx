import { requireDashboardUser, can } from '@/lib/session';
import { db } from '@bv/db';
import { pendingApprovalCount } from '@bv/db/queries';
import { TopNav } from '@/components/TopNav';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireDashboardUser();
  const pending = can(user.role, 'trip:approve') ? await pendingApprovalCount(db) : 0;
  return (
    <div className="min-h-[100dvh]">
      <TopNav role={user.role} name={user.name} pendingApprovals={pending} />
      <main className="mx-auto w-full max-w-[1400px] overflow-x-hidden p-4 lg:p-6">{children}</main>
    </div>
  );
}
