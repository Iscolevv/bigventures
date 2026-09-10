import Link from 'next/link';
import { requireDriver } from '@/lib/driver-session';
import { SignOut } from '@/components/SignOut';
import { InstallHint } from '@/components/driver/InstallHint';

export const dynamic = 'force-dynamic';

export default async function DriverLayout({ children }: { children: React.ReactNode }) {
  const me = await requireDriver();
  return (
    <div className="mx-auto flex min-h-[100dvh] w-full max-w-md flex-col bg-bg">
      <header
        className="sticky top-0 z-20 flex items-center justify-between bg-brand px-4 py-3 text-white"
        style={{ paddingTop: 'calc(0.75rem + env(safe-area-inset-top))' }}
      >
        <Link href="/d" className="-m-2 p-2 text-base font-semibold">
          Big Ventures
        </Link>
        <div className="flex items-center gap-1 text-sm">
          <Link href="/d/docs" className="-m-1 rounded p-2 opacity-90 active:bg-white/10">
            My docs
          </Link>
          <SignOut className="-m-1 rounded p-2 opacity-90 active:bg-white/10" />
        </div>
      </header>

      <InstallHint />

      <main className="flex-1 px-4 py-4">{children}</main>

      <footer
        className="border-t px-4 py-2 text-center text-[11px] text-muted"
        style={{ paddingBottom: 'calc(0.5rem + env(safe-area-inset-bottom))' }}
      >
        {me.name}
      </footer>
    </div>
  );
}
