'use client';
import { useState, useRef, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { addFuel } from '@/app/d/actions';
import { dInput, dLabel, dBtnPrimary } from './styles';

export function FuelForm({ tripId }: { tripId: string }) {
  const router = useRouter();
  const receiptRef = useRef<HTMLInputElement>(null);
  const [litres, setLitres] = useState('');
  const [unitPrice, setUnitPrice] = useState('');
  const [total, setTotal] = useState('');
  const [odometer, setOdometer] = useState('');
  const [station, setStation] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const recalc = (l: string, p: string) => {
    if (l && p) setTotal(String(Math.round(Number(l) * Number(p))));
  };

  function submit() {
    if (!litres || !total || !odometer) return setErr('Litres, total and odometer are required');
    const fd = new FormData();
    fd.set('tripId', tripId);
    fd.set('litres', litres);
    fd.set('total', total);
    if (unitPrice) fd.set('unitPrice', unitPrice);
    fd.set('odometer', odometer);
    if (station) fd.set('station', station);
    const f = receiptRef.current?.files?.[0];
    if (f) fd.set('receipt', f);
    setErr(null);
    start(async () => {
      const r = await addFuel(fd);
      if (r.error) setErr(r.error);
      else router.replace(`/d/t/${tripId}`);
    });
  }

  return (
    <div className="mt-4 space-y-4 pb-10">
      <div>
        <label className={dLabel}>Litres</label>
        <input className={dInput} inputMode="decimal" value={litres} onChange={(e) => { setLitres(e.target.value); recalc(e.target.value, unitPrice); }} />
      </div>
      <div>
        <label className={dLabel}>Price per litre (optional)</label>
        <input className={dInput} inputMode="decimal" value={unitPrice} onChange={(e) => { setUnitPrice(e.target.value); recalc(litres, e.target.value); }} />
      </div>
      <div>
        <label className={dLabel}>Total paid (KES)</label>
        <input className={dInput} inputMode="numeric" value={total} onChange={(e) => setTotal(e.target.value)} />
      </div>
      <div>
        <label className={dLabel}>Odometer (km)</label>
        <input className={dInput} inputMode="numeric" value={odometer} onChange={(e) => setOdometer(e.target.value)} />
      </div>
      <div>
        <label className={dLabel}>Station (optional)</label>
        <input className={dInput} value={station} onChange={(e) => setStation(e.target.value)} />
      </div>
      <div>
        <label className={dLabel}>Receipt photo (optional)</label>
        <input ref={receiptRef} type="file" accept="image/*" capture="environment" className="mt-1 block w-full text-sm" />
      </div>
      {err && <p className="wrap-anywhere text-sm text-crit">{err}</p>}
      <button onClick={submit} disabled={pending} className={dBtnPrimary}>
        {pending ? 'Saving…' : 'Save fuel entry'}
      </button>
    </div>
  );
}
