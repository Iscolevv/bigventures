'use client';
import { useTransition } from 'react';
import { setAlertStatus, rescan } from '@/app/(app)/alerts/actions';

export function RescanButton() {
  const [pending, start] = useTransition();
  return (
    <button
      onClick={() => start(() => rescan().then(() => {}))}
      disabled={pending}
      className="rounded-md border px-3 py-1.5 text-sm hover:bg-bg disabled:opacity-60"
    >
      {pending ? 'Scanning…' : 'Rescan now'}
    </button>
  );
}

export function AlertRowActions({ id, status }: { id: string; status: string }) {
  const [pending, start] = useTransition();
  return (
    <span className="flex justify-end gap-1">
      {status === 'open' && (
        <button
          onClick={() => start(() => setAlertStatus(id, 'acknowledged').then(() => {}))}
          disabled={pending}
          className="rounded-md border px-2 py-1 text-xs hover:bg-bg disabled:opacity-60"
        >
          Ack
        </button>
      )}
      <button
        onClick={() => start(() => setAlertStatus(id, 'resolved').then(() => {}))}
        disabled={pending}
        className="rounded-md border px-2 py-1 text-xs hover:bg-bg disabled:opacity-60"
      >
        Resolve
      </button>
      <button
        onClick={() => start(() => setAlertStatus(id, 'dismissed').then(() => {}))}
        disabled={pending}
        className="rounded-md border px-2 py-1 text-xs text-muted hover:bg-bg disabled:opacity-60"
      >
        Dismiss
      </button>
    </span>
  );
}
