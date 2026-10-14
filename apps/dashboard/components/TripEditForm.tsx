'use client';
import { ArrowDown, ArrowUp, Camera, Check, CirclePlus, Save, Trash2, X } from 'lucide-react';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { DROP_STATUSES } from '@bv/core/enums';
import type { EditorKind, TripEditDrop, TripEditValues } from '@/lib/trip-edit';
import { dInput, dLabel, dBtnPrimary, dChip } from './driver/styles';

const OFFICE = {
  input: 'mt-1 w-full rounded-md border bg-surface px-3 py-2 text-sm',
  label: 'block text-sm font-medium',
  btn: 'inline-flex items-center justify-center gap-2 rounded-md bg-brand px-5 py-2 text-sm font-semibold text-white disabled:opacity-50',
  chip: 'inline-flex items-center gap-1 rounded-md border px-2.5 py-1.5 text-xs hover:bg-bg',
};
const DRIVER = { input: dInput, label: dLabel, btn: dBtnPrimary, chip: `${dChip} inline-flex items-center gap-1.5` };

/** Today as YYYY-MM-DD in the browser's local time, for the date input's max. */
function today() {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

export function TripEditForm({
  initial,
  vehicles,
  editor,
  action,
  doneHref,
  approved = false,
}: {
  initial: TripEditValues;
  vehicles: { id: string; reg: string }[];
  editor: EditorKind;
  action: (form: FormData) => Promise<{ error?: string; ok?: boolean }>;
  doneHref: string;
  /** office editing a trip that already counts in the numbers */
  approved?: boolean;
}) {
  const router = useRouter();
  const office = editor === 'office';
  const c = office ? OFFICE : DRIVER;
  const tight = c.input.replace('mt-1 ', '');
  const [v, setV] = useState<TripEditValues>(initial);
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const set = <K extends keyof TripEditValues>(k: K, val: TripEditValues[K]) => setV((p) => ({ ...p, [k]: val }));
  const setDrop = (i: number, patch: Partial<TripEditDrop>) =>
    setV((p) => ({ ...p, drops: p.drops.map((d, j) => (j === i ? { ...d, ...patch } : d)) }));
  const move = (i: number, by: number) =>
    setV((p) => {
      const drops = [...p.drops];
      const j = i + by;
      if (j < 0 || j >= drops.length) return p;
      [drops[i], drops[j]] = [drops[j]!, drops[i]!];
      return { ...p, drops };
    });
  const remove = (i: number) => {
    const d = v.drops[i]!;
    if (d.photos > 0) {
      if (!office) return setErr(`"${d.address}" already has a PO photo - only the office can remove it`);
      if (!confirm(`Remove "${d.address}"? Its ${d.photos} PO photo${d.photos > 1 ? 's' : ''} will be removed too.`)) return;
    }
    setV((p) => ({ ...p, drops: p.drops.filter((_, j) => j !== i) }));
  };
  const addStop = () =>
    setV((p) => ({ ...p, drops: [...p.drops, { id: null, address: '', po: '', signee: '', status: 'delivered', photos: 0 }] }));

  function save() {
    const fd = new FormData();
    fd.set('payload', JSON.stringify(v));
    setErr(null);
    start(async () => {
      const r = await action(fd);
      if (r.error) setErr(r.error);
      else {
        router.replace(doneHref);
        router.refresh();
      }
    });
  }

  const vehicleOptions = vehicles.some((x) => x.id === v.vehicleId) ? vehicles : [{ id: v.vehicleId, reg: 'Current vehicle' }, ...vehicles];

  return (
    <div className={office ? 'max-w-3xl space-y-5' : 'mt-4 space-y-5'}>
      {approved && (
        <p className="rounded-lg border border-warn/50 bg-warn/10 px-3 py-2 text-sm text-warn">
          This trip is already approved - your changes go straight into the numbers. The old values are kept in the audit log.
        </p>
      )}

      <div className={office ? 'grid gap-3 sm:grid-cols-3' : 'grid grid-cols-2 gap-3'}>
        <div>
          <label className={c.label}>Vehicle</label>
          <select className={c.input} value={v.vehicleId} onChange={(e) => set('vehicleId', e.target.value)}>
            {vehicleOptions.map((x) => (
              <option key={x.id} value={x.id}>{x.reg}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={c.label}>Date</label>
          <input type="date" className={c.input} value={v.date} max={today()} onChange={(e) => set('date', e.target.value)} />
        </div>
        <div className={office ? '' : 'col-span-2'}>
          <label className={c.label}>Loading point</label>
          <input className={c.input} value={v.loadingAddress} onChange={(e) => set('loadingAddress', e.target.value)} placeholder="e.g. Ajab, C4 Beacon" />
        </div>
      </div>

      <div>
        <label className={c.label}>Stops</label>
        <div className="mt-2 space-y-2">
          {v.drops.map((d, i) => (
            <div key={d.id ?? `new-${i}`} className="rounded-lg border border-border bg-surface p-2.5">
              <div className="flex items-center gap-2">
                <span className="w-5 shrink-0 text-sm font-semibold text-muted">{i + 1}.</span>
                <input
                  className={tight}
                  value={d.address}
                  onChange={(e) => setDrop(i, { address: e.target.value })}
                  placeholder="Shop / customer / area"
                />
              </div>
              <div className={`mt-2 grid gap-2 ${office ? 'sm:grid-cols-3' : 'grid-cols-1'}`}>
                {office ? (
                  <select className={tight} value={d.status} onChange={(e) => setDrop(i, { status: e.target.value as TripEditDrop['status'] })}>
                    {DROP_STATUSES.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                ) : (
                  <button
                    type="button"
                    onClick={() => setDrop(i, { status: d.status === 'failed' ? 'delivered' : 'failed' })}
                    className={`inline-flex w-fit items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold active:opacity-80 ${
                      d.status === 'failed' ? 'bg-crit text-white' : 'bg-ok/15 text-ok'
                    }`}
                  >
                    {d.status === 'failed' ? <><X size={14} /> Failed</> : <><Check size={14} /> Delivered</>}
                  </button>
                )}
                {d.status !== 'failed' && (
                  <>
                    <input
                      className={tight}
                      value={d.po}
                      onChange={(e) => setDrop(i, { po: e.target.value })}
                      placeholder="PO number"
                      autoCapitalize="characters"
                    />
                    <input
                      className={tight}
                      value={d.signee}
                      onChange={(e) => setDrop(i, { signee: e.target.value })}
                      placeholder="Received by"
                    />
                  </>
                )}
              </div>
              <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
                <span className="inline-flex items-center gap-1">
                  <Camera size={14} />
                  {d.photos > 0 ? `${d.photos} PO photo${d.photos > 1 ? 's' : ''}` : d.id ? 'no photo yet' : 'new stop - add the photo from the trip page after saving'}
                </span>
                <span className="flex gap-1.5">
                  <button type="button" className={c.chip} onClick={() => move(i, -1)} disabled={i === 0} aria-label="Move up"><ArrowUp size={14} /></button>
                  <button type="button" className={c.chip} onClick={() => move(i, 1)} disabled={i === v.drops.length - 1} aria-label="Move down"><ArrowDown size={14} /></button>
                  <button type="button" className={`${c.chip} text-crit`} onClick={() => remove(i)} aria-label="Remove stop"><Trash2 size={14} /></button>
                </span>
              </div>
            </div>
          ))}
        </div>
        <button type="button" className={`${c.chip} mt-2`} onClick={addStop}>
          <CirclePlus size={15} /> Add a stop
        </button>
      </div>

      <div className={office ? 'grid gap-3 sm:grid-cols-3' : 'grid grid-cols-2 gap-3'}>
        <div>
          <label className={c.label}>Tonnes</label>
          <input className={c.input} inputMode="decimal" value={v.loadTonnes} onChange={(e) => set('loadTonnes', e.target.value)} />
        </div>
        <div>
          <label className={c.label}>Bales</label>
          <input className={c.input} inputMode="numeric" value={v.loadBales} onChange={(e) => set('loadBales', e.target.value)} />
        </div>
        <div>
          <label className={c.label}>Fuel (litres)</label>
          <input className={c.input} inputMode="decimal" value={v.fuelLitres} onChange={(e) => set('fuelLitres', e.target.value)} />
        </div>
        {office && (
          <div>
            <label className={c.label}>Fuel cost (Ksh)</label>
            <input className={c.input} inputMode="decimal" value={v.fuelCost} onChange={(e) => set('fuelCost', e.target.value)} placeholder="total paid" />
          </div>
        )}
        {office && (
          <div>
            <label className={c.label}>Start odometer (km)</label>
            <input className={c.input} inputMode="numeric" value={v.startOdometer} onChange={(e) => set('startOdometer', e.target.value)} />
          </div>
        )}
        <div>
          <label className={c.label}>Closing odometer (km)</label>
          <input className={c.input} inputMode="numeric" value={v.endOdometer} onChange={(e) => set('endOdometer', e.target.value)} />
        </div>
      </div>

      {err && <p className="wrap-anywhere text-sm text-crit">{err}</p>}
      <button type="button" onClick={save} disabled={pending} className={c.btn}>
        <Save size={office ? 16 : 20} />
        {pending ? 'Saving…' : 'Save changes'}
      </button>
    </div>
  );
}
