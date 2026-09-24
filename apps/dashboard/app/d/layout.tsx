import Link from 'next/link';
import { Truck } from 'lucide-react';
import { requireDriver } from '@/lib/driver-session';
import { SignOut } from '@/components/SignOut';
import { InstallHint } from '@/components/driver/InstallHint';
import { BottomNav } from '@/components/driver/BottomNav';

export const dynamic = 'force-dynamic';

export default async function DriverLayout({ children }: { children: React.ReactNode }) {
  const me = await requireDriver();
  const initial = me.name.trim().charAt(0).toUpperCase();
  return (
    <div className="mx-auto flex min-h-[100dvh] w-full max-w-md flex-col bg-bg">
      <header
        className="sticky top-0 z-20 flex items-center justify-between gap-3 bg-brand px-4 pb-3 text-white shadow-sm"
        style={{ paddingTop: 'calc(0.75rem + env(safe-area-inset-top))' }}
      >
        <Link href="/d" className="flex min-w-0 items-center gap-2.5 active:opacity-80">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white/15">
            <Truck size={20} />
          </span>
          <span className="min-w-0 leading-tight">
            <span className="block text-base font-semibold">Big Ventures</span>
            <span className="block truncate text-xs text-white/80">{me.name}</span>
          </span>
        </Link>
        <div className="flex shrink-0 items-center gap-2">
          <span
            aria-hidden
            className="grid h-9 w-9 place-items-center rounded-full bg-white/20 text-sm font-semibold"
          >
            {initial}
          </span>
          <SignOut className="grid h-10 w-10 place-items-center rounded-full text-white/90 active:bg-white/15" />
        </div>
      </header>

      <InstallHint />

      <main className="flex-1 px-4 py-4" style={{ paddingBottom: 'calc(6.5rem + env(safe-area-inset-bottom))' }}>
        {children}
      </main>

      <BottomNav />
    </div>
  );
}
