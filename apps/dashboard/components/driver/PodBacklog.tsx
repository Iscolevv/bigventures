import Link from 'next/link';
import type { PodBacklogItem } from '@bv/db/queries';

const fmt = (d: Date) =>
  d.toLocaleString('en-KE', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Nairobi' });

/** POs still waiting for their photo. Each row goes straight to the upload screen. */
export function PodBacklog({ items }: { items: PodBacklogItem[] }) {
  return (
    <div className="space-y-2">
      {items.map((b) => (
        <Link
          key={b.dropId}
          href={`/d/drop/${b.dropId}`}
          className={`block rounded-xl border p-3 text-sm active:opacity-80 ${b.overdue ? 'border-crit bg-crit/10' : 'border-warn bg-warn/10'}`}
        >
          <div className="flex items-start justify-between gap-2">
            <span className="font-semibold">PO {b.po ?? '(no number)'}</span>
            <span className={`shrink-0 text-xs font-semibold ${b.overdue ? 'text-crit' : 'text-warn'}`}>
              {b.overdue ? 'OVERDUE' : `due ${fmt(b.dueAt)}`}
            </span>
          </div>
          <p className="wrap-anywhere mt-0.5 text-muted">{b.destination} · {b.tripRef}</p>
        </Link>
      ))}
    </div>
  );
}
