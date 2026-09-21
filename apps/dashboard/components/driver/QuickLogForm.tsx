'use client';
import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { logCompletedTrip } from '@/app/d/actions';
import { dInput, dLabel, dBtnPrimary, dChip } from './styles';
import { compressImage } from './imageCompress';
import { PO_UPLOAD_WINDOW_HOURS } from '@bv/core/reference';

/** Today's date as YYYY-MM-DD in the browser's local time, for the date input default. */
function today() {
  const d = new Date();
  const tz = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - tz).toISOString().slice(0, 10);
}

export function QuickLogForm({
  vehicles,
  recentStops = [],
  lastTripStops = [],
}: {
  vehicles: { id: string; reg: string }[];
  recentStops?: string[];
  lastTripStops?: string[];
}) {
  const router = useRouter();
  const [vehicleId, setVehicleId] = useState(vehicles[0]?.id ?? '');
  const [date, setDate] = useState(today());
  const [loadingAddress, setLoadingAddress] = useState('');
  const [stopsText, setStopsText] = useState('');
  const [failed, setFailed] = useState<Set<number>>(new Set());
  const [pos, setPos] = useState<Record<number, string>>({});
  const [photos, setPhotos] = useState<Record<number, File>>({});
  const [previews, setPreviews] = useState<Record<number, string>>({});
  const [compressing, setCompressing] = useState<Set<number>>(new Set());
  const [loadTonnes, setLoadTonnes] = useState('');
  const [loadBales, setLoadBales] = useState('');
  const [fuelLitres, setFuelLitres] = useState('');
  const [fuelCost, setFuelCost] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const fileRefs = useRef<Record<number, HTMLInputElement | null>>({});

  const stops = useMemo(
    () => stopsText.split('\n').map((s) => s.trim()).filter(Boolean),
    [stopsText],
  );

  // object URLs are per-File - revoke on unmount so we don't leak memory
  useEffect(() => () => Object.values(previews).forEach((u) => URL.revokeObjectURL(u)), []); // eslint-disable-line react-hooks/exhaustive-deps

  function addStop(name: string) {
    setStopsText((t) => {
      const lines = t.split('\n').map((x) => x.trim()).filter(Boolean);
      if (lines.includes(name)) return t;
      return [...lines, name].join('\n');
    });
  }

  function toggleFailed(i: number) {
    setFailed((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  }

  async function onPhoto(i: number, file: File | undefined) {
    if (!file) return;
    setCompressing((c) => new Set(c).add(i));
    const small = await compressImage(file);
    setCompressing((c) => {
      const next = new Set(c);
      next.delete(i);
      return next;
    });
    setPreviews((p) => {
      if (p[i]) URL.revokeObjectURL(p[i]!);
      return { ...p, [i]: URL.createObjectURL(small) };
    });
    setPhotos((p) => ({ ...p, [i]: small }));
    setErr(null);
  }

  function submit() {
    if (!vehicleId) return setErr('Pick your vehicle');
    if (stops.length === 0) return setErr('Add at least one stop, one per line');
    if (compressing.size > 0) return setErr('Still processing a photo - give it a second');
    const missingPo = stops.map((_, i) => i).filter((i) => !failed.has(i) && !pos[i]?.trim());
    if (missingPo.length > 0) {
      return setErr(`Add the PO number for stop${missingPo.length > 1 ? 's' : ''} ${missingPo.map((i) => i + 1).join(', ')} - or mark it failed if it didn't go through`);
    }
    const fd = new FormData();
    fd.set('vehicleId', vehicleId);
    fd.set('date', date);
    fd.set('loadingAddress', loadingAddress.trim());
    fd.set('stops', stops.join('\n'));
    fd.set('failedIndexes', [...failed].join(','));
    stops.forEach((_, i) => {
      if (pos[i]?.trim()) fd.set(`po_${i}`, pos[i]!.trim());
      if (photos[i]) fd.set(`photo_${i}`, photos[i]!);
    });
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
        {(lastTripStops.length > 0 || recentStops.length > 0) && (
          <div className="mt-2 flex flex-wrap gap-2">
            {lastTripStops.length > 0 && stops.length === 0 && (
              <button type="button" className={`${dChip} border-brand text-brand`} onClick={() => setStopsText(lastTripStops.join('\n'))}>
                Repeat my last trip ({lastTripStops.length} stops)
              </button>
            )}
            {recentStops.map((r) => (
              <button type="button" key={r} className={dChip} onClick={() => addStop(r)}>
                + {r}
              </button>
            ))}
          </div>
        )}
        <textarea
          className={`${dInput} min-h-[140px]`}
          value={stopsText}
          onChange={(e) => setStopsText(e.target.value)}
          placeholder={'Quick mart tom mboya\nQuick mart OTC\nQuick mart mfangano'}
        />
        {stops.length > 0 && (
          <div className="mt-2 space-y-2">
            <p className="text-xs text-muted">Every delivered stop has its own PO. Type its number now and photograph it now, or within {PO_UPLOAD_WINDOW_HOURS} hours - you can&apos;t start the next day until it&apos;s uploaded. Mark a stop failed if it didn&apos;t go through.</p>
            {stops.map((s, i) => (
              <div key={i} className="rounded-lg border border-border bg-surface p-2.5">
                <div className="flex items-start justify-between gap-2">
                  <span className="wrap-anywhere text-sm">{i + 1}. {s}</span>
                  <button
                    type="button"
                    onClick={() => toggleFailed(i)}
                    className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold active:opacity-80 ${
                      failed.has(i) ? 'bg-crit text-white' : 'bg-ok/15 text-ok'
                    }`}
                  >
                    {failed.has(i) ? 'Failed ✗' : 'Delivered ✓'}
                  </button>
                </div>
                {!failed.has(i) && (
                  <input
                    className={`${dInput} mt-2`}
                    value={pos[i] ?? ''}
                    onChange={(e) => setPos((p) => ({ ...p, [i]: e.target.value }))}
                    placeholder="PO number for this stop"
                    autoCapitalize="characters"
                  />
                )}
                {!failed.has(i) && (
                  <div className="mt-2 flex items-center gap-2">
                    {previews[i] ? (
                      <img src={previews[i]} alt="POD" className="h-12 w-12 rounded-md object-cover" />
                    ) : (
                      <span className="grid h-12 w-12 shrink-0 place-items-center rounded-md border-2 border-dashed border-brand text-brand">📷</span>
                    )}
                    <button
                      type="button"
                      onClick={() => fileRefs.current[i]?.click()}
                      disabled={compressing.has(i)}
                      className={dChip}
                    >
                      {compressing.has(i) ? 'Compressing…' : previews[i] ? 'Retake PO photo' : 'Add PO photo (or later)'}
                    </button>
                    <input
                      ref={(el) => { fileRefs.current[i] = el; }}
                      type="file"
                      accept="image/*"
                      capture="environment"
                      className="hidden"
                      onChange={(e) => onPhoto(i, e.target.files?.[0])}
                    />
                  </div>
                )}
              </div>
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
