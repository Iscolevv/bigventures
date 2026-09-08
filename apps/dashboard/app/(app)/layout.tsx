import { requireDashboardUser } from '@/lib/session';
import { Sidebar } from '@/components/Sidebar';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireDashboardUser();
  return (
    <div className="flex min-h-screen">
      <Sidebar role={user.role} name={user.name} />
      <main className="flex-1 overflow-x-hidden p-6">{children}</main>
    </div>
  );
}
