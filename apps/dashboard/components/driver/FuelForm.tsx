'use client';
import { useState, useRef, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { addFuel } from '@/app/d/actions';

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

  const field = 'mt-1 w-full rounded-lg border bg-surface px-3 py-2.5 text-base';
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
        <label className="text-sm font-medium">Litres</label>
        <input className={field} inputMode="decimal" value={litres} onChange={(e) => { setLitres(e.target.value); recalc(e.target.value, unitPrice); }} />
      </div>
      <div>
        <label className="text-sm font-medium">Price per litre (optional)</label>
        <input className={field} inputMode="decimal" value={unitPrice} onChange={(e) => { setUnitPrice(e.target.value); recalc(litres, e.target.value); }} />
      </div>
      <div>
        <label className="text-sm font-medium">Total paid (KES)</label>
        <input className={field} inputMode="numeric" value={total} onChange={(e) => setTotal(e.target.value)} />
      </div>
      <div>
        <label className="text-sm font-medium">Odometer (km)</label>
        <input className={field} inputMode="numeric" value={odometer} onChange={(e) => setOdometer(e.target.value)} />
      </div>
      <div>
        <label className="text-sm font-medium">Station (optional)</label>
        <input className={field} value={station} onChange={(e) => setStation(e.target.value)} />
      </div>
      <div>
        <label className="text-sm font-medium">Receipt photo (optional)</label>
        <input ref={receiptRef} type="file" accept="image/*" capture="environment" className="mt-1 block w-full text-sm" />
      </div>
      {err && <p className="text-sm text-crit">{err}</p>}
      <button onClick={submit} disabled={pending} className="w-full rounded-lg bg-brand px-4 py-3 text-base font-semibold text-white disabled:opacity-60">
        {pending ? 'Saving…' : 'Save fuel entry'}
      </button>
    </div>
  );
}
