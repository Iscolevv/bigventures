'use client';
import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { logCompletedTrip } from '@/app/d/actions';
import { dInput, dLabel, dBtnPrimary, dChip } from './styles';

/** Today's date as YYYY-MM-DD in the browser's local time, for the date input default. */
function today() {
  const d = new Date();
  const tz = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - tz).toISOString().slice(0, 10);
}

export function QuickLogForm({ vehicles }: { vehicles: { id: string; reg: string }[] }) {
  const router = useRouter();
  const [vehicleId, setVehicleId] = useState(vehicles[0]?.id ?? '');
  const [date, setDate] = useState(today());
  const [loadingAddress, setLoadingAddress] = useState('');
  const [stopsText, setStopsText] = useState('');
  const [failed, setFailed] = useState<Set<number>>(new Set());
  const [loadTonnes, setLoadTonnes] = useState('');
  const [loadBales, setLoadBales] = useState('');
  const [fuelLitres, setFuelLitres] = useState('');
  const [fuelCost, setFuelCost] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const stops = useMemo(
    () => stopsText.split('\n').map((s) => s.trim()).filter(Boolean),
    [stopsText],
  );

  function toggleFailed(i: number) {
    setFailed((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  }

  function submit() {
    if (!vehicleId) return setErr('Pick your vehicle');
    if (stops.length === 0) return setErr('Add at least one stop, one per line');
    const fd = new FormData();
    fd.set('vehicleId', vehicleId);
    fd.set('date', date);
    fd.set('loadingAddress', loadingAddress.trim());
    fd.set('stops', stops.join('\n'));
    fd.set('failedIndexes', [...failed].join(','));
    if (loadTonnes.trim()) fd.set('loadTonnes', loadTonnes.trim());
    if (loadBales.trim()) fd.set('loadBales', loadBales.trim());
    if (fuelLitres.trim()) fd.set('fuelLitres', fuelLitres.trim());
    if (fuelCost.trim()) fd.set('fuelCost', fuelCost.trim());
    setErr(null);
    start(async () => {
      const r = await logCompletedTrip(fd);
      if (r.error) setErr(r.error);
      else router.replace(`/d/t/${r.id}`);
    });
  }

  if (vehicles.length === 0) {
    return <p className="mt-4 rounded-lg border bg-surface p-4 text-sm text-muted">No vehicle is assigned to you. Ask the office.</p>;
  }

  return (
    <div className="mt-4 space-y-5">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={dLabel}>Vehicle</label>
          <select className={dInput} value={vehicleId} onChange={(e) => setVehicleId(e.target.value)}>
            {vehicles.map((v) => (
              <option key={v.id} value={v.id}>{v.reg}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={dLabel}>Date</label>
          <input type="date" className={dInput} value={date} onChange={(e) => setDate(e.target.value)} max={today()} />
        </div>
      </div>

      <div>
        <label className={dLabel}>Loading point (optional)</label>
        <input className={dInput} value={loadingAddress} onChange={(e) => setLoadingAddress(e.target.value)} placeholder="e.g. Ajab, C4 Beacon" />
      </div>

      <div>
        <label className={dLabel}>Stops - one per line, same as you'd text the group</label>
        <textarea
          className={`${dInput} min-h-[140px]`}
          value={stopsText}
          onChange={(e) => setStopsText(e.target.value)}
          placeholder={'Quick mart tom mboya\nQuick mart OTC\nQuick mart mfangano'}
        />
        {stops.length > 0 && (
          <div className="mt-2 space-y-1.5">
            <p className="text-xs text-muted">Tap a stop that didn&apos;t go through - everything else counts as delivered.</p>
            {stops.map((s, i) => (
              <button
                type="button"
                key={i}
                onClick={() => toggleFailed(i)}
                className={`flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left text-sm active:opacity-80 ${
                  failed.has(i) ? 'border-crit bg-crit/10 text-crit' : 'border-border bg-surface'
                }`}
              >
                <span className="wrap-anywhere">{i + 1}. {s}</span>
                <span className="shrink-0 pl-2 text-xs font-semibold">{failed.has(i) ? 'Failed ✗' : 'Delivered ✓'}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div>
        <label className={dLabel}>Load (optional - whichever one applies)</label>
        <div className="mt-1 grid grid-cols-2 gap-3">
          <input className={dInput} inputMode="decimal" value={loadTonnes} onChange={(e) => setLoadTonnes(e.target.value)} placeholder="Tonnes, e.g. 2.7" />
          <input className={dInput} inputMode="numeric" value={loadBales} onChange={(e) => setLoadBales(e.target.value)} placeholder="Bales, e.g. 430" />
        </div>
      </div>

      <div>
        <label className={dLabel}>Fuel (optional)</label>
        <div className="mt-1 grid grid-cols-2 gap-3">
          <input className={dInput} inputMode="decimal" value={fuelLitres} onChange={(e) => setFuelLitres(e.target.value)} placeholder="Litres, e.g. 10" />
          <input className={dInput} inputMode="decimal" value={fuelCost} onChange={(e) => setFuelCost(e.target.value)} placeholder="Cost, if you know it" />
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          {[10, 15, 20, 50].map((l) => (
            <button type="button" key={l} className={dChip} onClick={() => setFuelLitres(String(l))}>{l}L</button>
          ))}
        </div>
      </div>

      {err && <p className="wrap-anywhere text-sm text-crit">{err}</p>}
      <button onClick={submit} disabled={pending} className={dBtnPrimary}>
        {pending ? 'Logging…' : `Log ${stops.length || ''} stop${stops.length === 1 ? '' : 's'}`}
      </button>
    </div>
  );
}
