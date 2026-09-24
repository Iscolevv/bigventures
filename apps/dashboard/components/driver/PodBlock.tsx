import { TriangleAlert } from 'lucide-react';
import type { PodBacklogItem } from '@bv/db/queries';
import { PodBacklog } from './PodBacklog';

/** Shown instead of a form when the driver has POs past the upload window. */
export function PodBlock({ items, hours }: { items: PodBacklogItem[]; hours: number }) {
  return (
    <div className="mt-4">
      <div className="rounded-xl border border-crit bg-crit/10 p-4 text-sm">
        <p className="flex items-center gap-2 font-semibold text-crit"><TriangleAlert size={18} /> Upload your POs before you continue</p>
        <p className="mt-1 text-muted">
          POs must be uploaded within {hours} hours. Tap each one below and add its photo, then you can carry on.
        </p>
      </div>
      <div className="mt-3">
        <PodBacklog items={items} />
      </div>
    </div>
  );
}
