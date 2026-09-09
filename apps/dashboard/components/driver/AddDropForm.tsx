'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { addDrop } from '@/app/d/actions';
import { GeoButton } from './GeoButton';

export function AddDropForm({ tripId }: { tripId: string }) {
  const router = useRouter();
  const [address, setAddress] = useState('');
  const [pin, setPin] = useState<{ lat: number; lng: number } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function submit() {
    if (!address.trim()) return setErr('Address required');
    const fd = new FormData();
    fd.set('tripId', tripId);
    fd.set('address', address.trim());
    if (pin) {
      fd.set('lat', String(pin.lat));
      fd.set('lng', String(pin.lng));
    }
    setErr(null);
    start(async () => {
      const r = await addDrop(fd);
      if (r.error) setErr(r.error);
      else {
        setAddress('');
        setPin(null);
        router.refresh();
      }
    });
  }

  return (
    <div className="mt-2 space-y-3">
      <input
        className="w-full rounded-lg border bg-surface px-3 py-2.5 text-base"
        value={address}
        onChange={(e) => setAddress(e.target.value)}
        placeholder="Shop / customer / area"
      />
      <GeoButton onFix={(c) => setPin({ lat: c.lat, lng: c.lng })} label={pin ? 'Location pinned ✓' : "Pin (if you're there now)"} />
      {err && <p className="text-sm text-crit">{err}</p>}
      <button
        onClick={submit}
        disabled={pending}
        className="w-full rounded-lg bg-brand px-4 py-3 text-base font-semibold text-white disabled:opacity-60"
      >
        {pending ? 'Adding…' : 'Add drop'}
      </button>
    </div>
  );
}
