'use client';
import { useState } from 'react';
import { authClient } from '@/lib/auth-client';

export function ChangePassword() {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const field = 'mt-1 w-full rounded-md border bg-bg px-3 py-2 text-sm';

  async function submit() {
    if (next.length < 8) return setMsg('New password must be at least 8 characters');
    setBusy(true);
    setMsg(null);
    const { error } = await authClient.changePassword({
      currentPassword: current,
      newPassword: next,
      revokeOtherSessions: true,
    });
    setBusy(false);
    if (error) setMsg(`✗ ${error.message ?? 'Failed'}`);
    else {
      setMsg('✓ Password changed');
      setCurrent('');
      setNext('');
    }
  }

  return (
    <div className="max-w-sm space-y-3">
      <div>
        <label className="text-sm font-medium">Current password</label>
        <input type="password" className={field} value={current} onChange={(e) => setCurrent(e.target.value)} />
      </div>
      <div>
        <label className="text-sm font-medium">New password</label>
        <input type="password" className={field} value={next} onChange={(e) => setNext(e.target.value)} />
      </div>
      <div className="flex items-center gap-3">
        <button
          onClick={submit}
          disabled={busy || !current || !next}
          className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
        >
          {busy ? 'Changing…' : 'Change password'}
        </button>
        {msg && <span className="text-sm text-muted">{msg}</span>}
      </div>
    </div>
  );
}
