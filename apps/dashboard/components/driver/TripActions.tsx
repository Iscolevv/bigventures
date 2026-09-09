'use client';
import { useState, useTransition } from 'react';
import Link from 'next/link';
import { startTrip, closeTrip } from '@/app/d/actions';

export function TripActions({
  tripId,
  status,
  hasCheck,
  dropCount,
  allClosed,
}: {
  tripId: string;
  status: string;
  hasCheck: boolean;
  dropCount: number;
  allClosed: boolean;
}) {
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const [endOdo, setEndOdo] = useState('');

  const btn = 'w-full rounded-lg px-4 py-3 text-base font-semibold text-white disabled:opacity-50';

  return (
    <div className="mt-6 space-y-3">
      {err && <p className="text-sm text-crit">{err}</p>}

      {(status === 'draft' || status === 'pre_check') && (
        <Link href={`/d/t/${tripId}/check`} className={`${btn} block bg-brand text-center`}>
          {hasCheck ? 'Redo vehicle check' : 'Vehicle check'}
        </Link>
      )}

      {status === 'pre_check' && (
        <button
          className={`${btn} bg-brand`}
          disabled={pending || dropCount === 0 || !hasCheck}
          onClick={() =>
            start(async () => {
              const r = await startTrip(tripId);
              if (r.error) setErr(r.error);
            })
          }
        >
          {dropCount === 0 ? 'Add a drop first' : !hasCheck ? 'Do the check first' : 'Start driving'}
        </button>
      )}

      {status === 'in_progress' && (
        <>
          <Link href={`/d/t/${tripId}/fuel`} className="block w-full rounded-lg border px-4 py-3 text-center text-base font-semibold text-brand">
            Log fuel
          </Link>
          <div className="rounded-xl border bg-surface p-3">
            <label className="text-sm font-medium">Closing odometer (km)</label>
            <input
              className="mt-1 w-full rounded-lg border bg-bg px-3 py-2.5 text-base"
              inputMode="numeric"
              value={endOdo}
              onChange={(e) => setEndOdo(e.target.value)}
            />
            <button
              className={`${btn} mt-3 bg-ok`}
              disabled={pending || !allClosed}
              onClick={() =>
                start(async () => {
                  const fd = new FormData();
                  fd.set('tripId', tripId);
                  if (endOdo) fd.set('endOdometer', endOdo);
                  const r = await closeTrip(fd);
                  if (r.error) setErr(r.error);
                })
              }
            >
              {allClosed ? 'Finish trip' : 'Close all drops first'}
            </button>
          </div>
        </>
      )}

      {status === 'completed' && <p className="text-center text-sm text-ok">Trip completed ✓</p>}
    </div>
  );
}
