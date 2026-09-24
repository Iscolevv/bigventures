'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { House, Plus, FileText } from 'lucide-react';

/** Phone-app style tab bar: Trips, the big Log button, and Documents. */
export function BottomNav() {
  const path = usePathname();
  const onHome = path === '/d' || path.startsWith('/d/t/') || path.startsWith('/d/drop/');
  const onLog = path.startsWith('/d/log');
  const onDocs = path.startsWith('/d/docs');

  const tab = (active: boolean) =>
    `flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] font-medium transition-colors active:opacity-70 ${
      active ? 'text-brand' : 'text-muted'
    }`;

  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-30 mx-auto w-full max-w-md border-t bg-surface/95 backdrop-blur"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="flex items-end px-2">
        <Link href="/d" className={tab(onHome)} aria-current={onHome ? 'page' : undefined}>
          <House size={22} strokeWidth={onHome ? 2.4 : 2} />
          Trips
        </Link>

        <Link href="/d/log" className="relative -mt-5 flex flex-1 flex-col items-center gap-0.5 pb-2 text-[11px] font-semibold text-brand active:opacity-80" aria-current={onLog ? 'page' : undefined}>
          <span
            className={`grid h-14 w-14 place-items-center rounded-full bg-brand text-white shadow-lg ring-4 ring-surface ${
              onLog ? 'brightness-110' : ''
            }`}
          >
            <Plus size={28} strokeWidth={2.6} />
          </span>
          Log a trip
        </Link>

        <Link href="/d/docs" className={tab(onDocs)} aria-current={onDocs ? 'page' : undefined}>
          <FileText size={22} strokeWidth={onDocs ? 2.4 : 2} />
          Documents
        </Link>
      </div>
    </nav>
  );
}
