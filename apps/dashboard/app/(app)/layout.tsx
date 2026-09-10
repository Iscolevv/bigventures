import { requireDashboardUser } from '@/lib/session';
import { Sidebar } from '@/components/Sidebar';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireDashboardUser();
  return (
    <div className="flex min-h-[100dvh] flex-col lg:flex-row">
      <Sidebar role={user.role} name={user.name} />
      <main className="min-w-0 flex-1 overflow-x-hidden p-4 lg:p-6">{children}</main>
    </div>
  );
}
