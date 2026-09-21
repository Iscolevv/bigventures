'use client';
import { useState, useTransition } from 'react';
import { removePodPhoto } from '@/app/(app)/trips/[id]/actions';

export function RemovePodButton({ photoId }: { photoId: string }) {
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  return (
    <span className="inline-flex flex-col">
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          if (!confirm('Remove this PO photo? This is recorded in the audit trail.')) return;
          start(async () => {
            const r = await removePodPhoto(photoId);
            if (r.error) setErr(r.error);
          });
        }}
        className="text-xs text-crit hover:underline disabled:opacity-50"
      >
        {pending ? 'Removing…' : 'Remove'}
      </button>
      {err && <span className="text-xs text-crit">{err}</span>}
    </span>
  );
}
