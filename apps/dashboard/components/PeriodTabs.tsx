'use client';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';

const OPTIONS = [
  { key: 'month', label: 'This month' },
  { key: '30d', label: 'Last 30 days' },
  { key: '90d', label: 'Last 90 days' },
  { key: 'all', label: 'All time' },
] as const;

export function PeriodTabs({ current }: { current: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  function set(key: string) {
    const next = new URLSearchParams(params);
    next.set('period', key);
    router.push(`${pathname}?${next.toString()}`);
  }

  return (
    <div className="inline-flex rounded-lg border bg-surface p-0.5 text-sm">
      {OPTIONS.map((o) => (
        <button
          key={o.key}
          onClick={() => set(o.key)}
          className={`rounded-md px-3 py-1.5 ${
            current === o.key ? 'bg-brand text-white' : 'text-muted hover:text-fg'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
