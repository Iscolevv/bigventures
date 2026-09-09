'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { createTrip } from '@/app/d/actions';
import { GeoButton } from './GeoButton';

export function NewTripForm({ vehicles }: { vehicles: { id: string; reg: string }[] }) {
  const router = useRouter();
  const [vehicleId, setVehicleId] = useState(vehicles[0]?.id ?? '');
  const [address, setAddress] = useState('');
  const [cargo, setCargo] = useState('');
  const [pin, setPin] = useState<{ lat: number; lng: number } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const field = 'mt-1 w-full rounded-lg border bg-surface px-3 py-2.5 text-base';

  function submit() {
    if (!vehicleId || !address.trim()) return setErr('Vehicle and loading point are required');
    const fd = new FormData();
    fd.set('vehicleId', vehicleId);
    fd.set('loadingAddress', address.trim());
    if (cargo.trim()) fd.set('cargo', cargo.trim());
    if (pin) {
      fd.set('lat', String(pin.lat));
      fd.set('lng', String(pin.lng));
    }
    setErr(null);
    start(async () => {
      const r = await createTrip(fd);
      if (r.error) setErr(r.error);
      else router.replace(`/d/t/${r.id}`);
    });
  }

  if (vehicles.length === 0) {
    return <p className="mt-4 rounded-lg border bg-surface p-4 text-sm text-muted">No vehicle is assigned to you. Ask the office.</p>;
  }

  return (
    <div className="mt-4 space-y-4">
      <div>
        <label className="text-sm font-medium">Vehicle</label>
        <select className={field} value={vehicleId} onChange={(e) => setVehicleId(e.target.value)}>
          {vehicles.map((v) => (
            <option key={v.id} value={v.id}>
              {v.reg}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="text-sm font-medium">Loading point</label>
        <input className={field} value={address} onChange={(e) => setAddress(e.target.value)} placeholder="e.g. CST Yard, Industrial Area" />
        <div className="mt-2">
          <GeoButton onFix={(c) => setPin({ lat: c.lat, lng: c.lng })} label="Pin where I'm loading" />
        </div>
      </div>
      <div>
        <label className="text-sm font-medium">Cargo (optional)</label>
        <input className={field} value={cargo} onChange={(e) => setCargo(e.target.value)} placeholder="What are you carrying?" />
      </div>
      {err && <p className="text-sm text-crit">{err}</p>}
      <button
        onClick={submit}
        disabled={pending}
        className="w-full rounded-lg bg-brand px-4 py-3 text-base font-semibold text-white disabled:opacity-60"
      >
        {pending ? 'Creating…' : 'Create trip'}
      </button>
    </div>
  );
}
