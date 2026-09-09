import Link from 'next/link';
import { requireDriver } from '@/lib/driver-session';
import { SignOut } from '@/components/SignOut';

export const dynamic = 'force-dynamic';

export default async function DriverLayout({ children }: { children: React.ReactNode }) {
  const me = await requireDriver();
  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col bg-bg">
      <header className="flex items-center justify-between border-b bg-brand px-4 py-3 text-white">
        <Link href="/d" className="text-sm font-semibold">
          Big Ventures
        </Link>
        <div className="flex items-center gap-3 text-xs">
          <Link href="/d/docs" className="opacity-90">
            My docs
          </Link>
          <SignOut className="opacity-90" />
        </div>
      </header>
      <main className="flex-1 p-4">{children}</main>
      <footer className="border-t px-4 py-2 text-center text-[11px] text-muted">{me.name}</footer>
    </div>
  );
}
