'use client';
import { useState, useTransition } from 'react';
import { saveSettings } from '@/app/(app)/settings/actions';

type Form = {
  companyName: string;
  companyKraPin: string;
  invoiceTaxPct: string;
  invoicePrefix: string;
  tripPrefix: string;
};

export function SettingsForm({ initial }: { initial: Form }) {
  const [form, setForm] = useState(initial);
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const set = (k: keyof Form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [k]: e.target.value });

  const field = 'mt-1 w-full rounded-md border bg-bg px-3 py-2 text-sm';

  return (
    <div className="max-w-lg space-y-4">
      <div>
        <label className="text-sm font-medium">Company name</label>
        <input className={field} value={form.companyName} onChange={set('companyName')} />
      </div>
      <div>
        <label className="text-sm font-medium">KRA PIN</label>
        <input className={field} value={form.companyKraPin} onChange={set('companyKraPin')} />
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="text-sm font-medium">Tax %</label>
          <input className={field} value={form.invoiceTaxPct} onChange={set('invoiceTaxPct')} inputMode="decimal" />
        </div>
        <div>
          <label className="text-sm font-medium">Invoice prefix</label>
          <input className={field} value={form.invoicePrefix} onChange={set('invoicePrefix')} />
        </div>
        <div>
          <label className="text-sm font-medium">Trip prefix</label>
          <input className={field} value={form.tripPrefix} onChange={set('tripPrefix')} />
        </div>
      </div>
      <div className="flex items-center gap-3">
        <button
          onClick={() =>
            start(async () => {
              const r = await saveSettings(form);
              setMsg(r.error ? `✗ ${r.error}` : '✓ Saved');
            })
          }
          disabled={pending}
          className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
        >
          {pending ? 'Saving…' : 'Save settings'}
        </button>
        {msg && <span className="text-sm text-muted">{msg}</span>}
      </div>
    </div>
  );
}
