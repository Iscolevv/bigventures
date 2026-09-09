'use client';
import { useState, useTransition } from 'react';
import { recomputeRoute } from '@/app/(app)/trips/[id]/actions';

export function RouteButton({ tripId }: { tripId: string }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <span className="flex items-center gap-2">
      <button
        onClick={() =>
          start(async () => {
            const r = await recomputeRoute(tripId);
            setMsg(r.error ? `✗ ${r.error}` : `✓ ${r.distanceKm} km planned route`);
          })
        }
        disabled={pending}
        className="rounded-md border px-3 py-1.5 text-sm hover:bg-bg disabled:opacity-60"
      >
        {pending ? 'Computing…' : 'Compute planned route'}
      </button>
      {msg && <span className="text-xs text-muted">{msg}</span>}
    </span>
  );
}
