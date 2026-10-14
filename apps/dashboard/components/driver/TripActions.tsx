'use client';
import { CheckCircle2, ClipboardCheck, Clock, Flag, Fuel, Pencil, Play } from 'lucide-react';
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

      {(status === 'draft' || status === 'pre_check') && !hasCheck && (
        <Link href="/d/check" className={dBtnPrimary}>
          <ClipboardCheck size={20} />
          Do today&apos;s vehicle check
        </Link>
      )}

      {(status === 'draft' || status === 'pre_check') && hasCheck && (
        <button
          className={dBtnPrimary}
          disabled={pending || dropCount === 0}
          onClick={() =>
            start(async () => {
              const r = await startTrip(tripId);
              if (r.error) setErr(r.error);
            })
          }
        >
          <Play size={20} />
          {dropCount === 0 ? 'Add a drop first' : 'Start driving'}
        </button>
      )}

      {status === 'in_progress' && (
        <>
          <Link href={`/d/t/${tripId}/fuel`} className={dBtnOutline}>
            <Fuel size={20} />
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
              <Flag size={20} />
              {allClosed ? 'Finish trip' : 'Close all drops first'}
            </button>
          </div>
        </>
      )}

      {status === 'submitted' && (
        <>
          <Link href={`/d/t/${tripId}/edit`} className={dBtnOutline}>
            <Pencil size={20} />
            Edit this trip
          </Link>
          <p className="flex items-center justify-center gap-2 text-center text-sm text-warn"><Clock size={16} /> Sent to the office. You can still fix it until they approve it.</p>
        </>
      )}
      {status === 'completed' && (
        <p className="text-center text-sm">
          <span className="flex items-center justify-center gap-2 font-medium text-ok"><CheckCircle2 size={18} /> Approved</span>
          <span className="mt-1 block text-xs text-muted">Something wrong? Tell the office - they can correct it.</span>
        </p>
      )}
    </div>
  );
}
