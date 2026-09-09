'use client';
import { useState, useTransition } from 'react';
import { generateInvoiceForClient, setInvoiceStatus } from '@/app/(app)/invoicing/actions';

export function GenerateInvoice({ clients }: { clients: { id: string; name: string; unbilled: number }[] }) {
  const [clientId, setClientId] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();

  return (
    <div className="flex flex-wrap items-center gap-2">
      <select
        value={clientId}
        onChange={(e) => setClientId(e.target.value)}
        className="rounded-md border bg-surface px-2 py-1.5 text-sm"
      >
        <option value="">Select client…</option>
        {clients.map((c) => (
          <option key={c.id} value={c.id} disabled={c.unbilled === 0}>
            {c.name} ({c.unbilled} unbilled)
          </option>
        ))}
      </select>
      <button
        disabled={!clientId || pending}
        onClick={() =>
          start(async () => {
            const r = await generateInvoiceForClient(clientId);
            setMsg(r.error ? `✗ ${r.error}` : `✓ ${r.lines} lines${r.flagged ? ' — flagged (unresolved issues)' : ''}`);
          })
        }
        className="rounded-md bg-brand px-3 py-1.5 text-sm font-medium text-white disabled:opacity-60"
      >
        {pending ? 'Drafting…' : 'Draft invoice'}
      </button>
      {msg && <span className="text-sm text-muted">{msg}</span>}
    </div>
  );
}

export function InvoiceStatusButton({ id, status }: { id: string; status: string }) {
  const [pending, start] = useTransition();
  if (status === 'paid' || status === 'void') return null;
  const next = status === 'draft' ? 'issued' : 'paid';
  return (
    <button
      onClick={() => start(() => setInvoiceStatus(id, next).then(() => {}))}
      disabled={pending}
      className="rounded-md border px-2 py-1 text-xs hover:bg-bg disabled:opacity-60"
    >
      {pending ? '…' : next === 'issued' ? 'Issue' : 'Mark paid'}
    </button>
  );
}
