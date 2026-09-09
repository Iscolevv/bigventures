'use client';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';

const STATUSES = ['', 'completed', 'in_progress', 'pre_check', 'flagged', 'cancelled'];

export function TripFilters({
  drivers,
  vehicles,
}: {
  drivers: { id: string; name: string }[];
  vehicles: { id: string; registration: string }[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  function set(k: string, v: string) {
    const next = new URLSearchParams(params);
    if (v) next.set(k, v);
    else next.delete(k);
    router.push(`${pathname}?${next.toString()}`);
  }

  const sel = 'rounded-md border bg-surface px-2 py-1.5 text-sm';

  return (
    <div className="mb-4 flex flex-wrap gap-2">
      <select className={sel} value={params.get('driver') ?? ''} onChange={(e) => set('driver', e.target.value)}>
        <option value="">All drivers</option>
        {drivers.map((d) => (
          <option key={d.id} value={d.id}>
            {d.name}
          </option>
        ))}
      </select>
      <select className={sel} value={params.get('vehicle') ?? ''} onChange={(e) => set('vehicle', e.target.value)}>
        <option value="">All vehicles</option>
        {vehicles.map((v) => (
          <option key={v.id} value={v.id}>
            {v.registration}
          </option>
        ))}
      </select>
      <select className={sel} value={params.get('status') ?? ''} onChange={(e) => set('status', e.target.value)}>
        {STATUSES.map((s) => (
          <option key={s} value={s}>
            {s ? s.replace('_', ' ') : 'Any status'}
          </option>
        ))}
      </select>
      <input
        type="date"
        className={sel}
        value={params.get('from') ?? ''}
        onChange={(e) => set('from', e.target.value)}
        aria-label="from date"
      />
      {(params.get('driver') || params.get('vehicle') || params.get('status') || params.get('from')) && (
        <button className="text-sm text-muted hover:text-fg" onClick={() => router.push(pathname)}>
          Clear
        </button>
      )}
    </div>
  );
}
