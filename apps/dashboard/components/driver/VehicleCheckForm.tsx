'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { submitVehicleCheck } from '@/app/d/actions';

interface Item {
  key: string;
  label: string;
  blocking: boolean;
  valueHint?: string;
}
type Result = 'pass' | 'fail' | 'na';

export function VehicleCheckForm({ tripId, template }: { tripId: string; template: Item[] }) {
  const router = useRouter();
  const [state, setState] = useState<Record<string, { result: Result | null; value?: string; notes?: string }>>(
    () => Object.fromEntries(template.map((i) => [i.key, { result: null }])),
  );
  const [odometer, setOdometer] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const set = (k: string, patch: Partial<{ result: Result; value: string; notes: string }>) =>
    setState((s) => ({ ...s, [k]: { ...s[k]!, ...patch } }));

  const unanswered = template.some((i) => state[i.key]?.result == null);
  const blockingFail = template.filter((i) => i.blocking && state[i.key]?.result === 'fail');

  function submit() {
    if (unanswered) return setErr('Answer every item');
    const items = template.map((i) => ({
      key: i.key,
      result: state[i.key]!.result!,
      value: state[i.key]!.value,
      notes: state[i.key]!.notes,
    }));
    const fd = new FormData();
    fd.set('tripId', tripId);
    if (odometer) fd.set('odometer', odometer);
    fd.set('items', JSON.stringify(items));
    setErr(null);
    start(async () => {
      const r = await submitVehicleCheck(fd);
      if (r.error) setErr(r.error);
      else router.replace(`/d/t/${tripId}`);
    });
  }

  return (
    <div className="mt-4 space-y-4 pb-10">
      <div>
        <label className="text-sm font-medium">Odometer (km)</label>
        <input
          className="mt-1 w-full rounded-lg border bg-surface px-3 py-2.5 text-base"
          inputMode="numeric"
          value={odometer}
          onChange={(e) => setOdometer(e.target.value)}
        />
      </div>

      {template.map((i) => {
        const st = state[i.key]!;
        return (
          <div key={i.key} className="rounded-xl border bg-surface p-3">
            <p className="text-sm font-medium">
              {i.label} {i.blocking && <span className="text-xs font-normal text-warn">· critical</span>}
            </p>
            <div className="mt-2 flex gap-2">
              {(['pass', 'fail', 'na'] as Result[]).map((r) => (
                <button
                  key={r}
                  onClick={() => set(i.key, { result: r })}
                  className={`flex-1 rounded-lg border py-2 text-sm font-semibold ${
                    st.result === r ? 'border-brand bg-brand text-white' : 'text-fg'
                  }`}
                >
                  {r.toUpperCase()}
                </button>
              ))}
            </div>
            {i.valueHint && (
              <input
                className="mt-2 w-full rounded-lg border bg-bg px-3 py-2 text-sm"
                placeholder={i.valueHint}
                value={st.value ?? ''}
                onChange={(e) => set(i.key, { value: e.target.value })}
              />
            )}
            {st.result === 'fail' && (
              <input
                className="mt-2 w-full rounded-lg border bg-bg px-3 py-2 text-sm"
                placeholder="What's wrong?"
                value={st.notes ?? ''}
                onChange={(e) => set(i.key, { notes: e.target.value })}
              />
            )}
          </div>
        );
      })}

      {blockingFail.length > 0 && (
        <p className="text-sm text-warn">
          {blockingFail.length} critical item(s) failed — the trip will be held for the office.
        </p>
      )}
      {err && <p className="text-sm text-crit">{err}</p>}
      <button
        onClick={submit}
        disabled={pending}
        className="w-full rounded-lg bg-brand px-4 py-3 text-base font-semibold text-white disabled:opacity-60"
      >
        {pending ? 'Submitting…' : 'Submit check'}
      </button>
    </div>
  );
}
