'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { createTrip } from '@/app/d/actions';
import { GeoButton } from './GeoButton';
import { dInput, dLabel, dBtnPrimary } from './styles';

export function NewTripForm({ vehicles }: { vehicles: { id: string; reg: string }[] }) {
  const router = useRouter();
  const [vehicleId, setVehicleId] = useState(vehicles[0]?.id ?? '');
  const [address, setAddress] = useState('');
  const [cargo, setCargo] = useState('');
  const [pin, setPin] = useState<{ lat: number; lng: number } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();

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
        <label className={dLabel}>Vehicle</label>
        <select className={dInput} value={vehicleId} onChange={(e) => setVehicleId(e.target.value)}>
          {vehicles.map((v) => (
            <option key={v.id} value={v.id}>
              {v.reg}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className={dLabel}>Loading point</label>
        <input className={dInput} value={address} onChange={(e) => setAddress(e.target.value)} placeholder="e.g. CST Yard, Industrial Area" />
        <div className="mt-2">
          <GeoButton onFix={(c) => setPin({ lat: c.lat, lng: c.lng })} label="Pin where I'm loading" />
        </div>
      </div>
      <div>
        <label className={dLabel}>Cargo (optional)</label>
        <input className={dInput} value={cargo} onChange={(e) => setCargo(e.target.value)} placeholder="What are you carrying?" />
      </div>
      {err && <p className="wrap-anywhere text-sm text-crit">{err}</p>}
      <button onClick={submit} disabled={pending} className={dBtnPrimary}>
        {pending ? 'Creating…' : 'Create trip'}
      </button>
    </div>
  );
}
