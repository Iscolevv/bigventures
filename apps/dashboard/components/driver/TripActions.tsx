'use client';
import { useState, useTransition } from 'react';
import Link from 'next/link';
import { startTrip, closeTrip } from '@/app/d/actions';
import { dInput, dLabel, dBtnPrimary, dBtnOutline, dBtnOk } from './styles';

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

  return (
    <div className="mt-6 space-y-3">
      {err && <p className="wrap-anywhere text-sm text-crit">{err}</p>}

      {(status === 'draft' || status === 'pre_check') && (
        <Link href={`/d/t/${tripId}/check`} className={dBtnPrimary}>
          {hasCheck ? 'Redo vehicle check' : 'Vehicle check'}
        </Link>
      )}

      {status === 'pre_check' && (
        <button
          className={dBtnPrimary}
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
          <Link href={`/d/t/${tripId}/fuel`} className={dBtnOutline}>
            Log fuel
          </Link>
          <div className="rounded-xl border bg-surface p-3.5">
            <label className={dLabel}>Closing odometer (km)</label>
            <input
              className={dInput}
              inputMode="numeric"
              value={endOdo}
              onChange={(e) => setEndOdo(e.target.value)}
            />
            <button
              className={`${dBtnOk} mt-3`}
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
