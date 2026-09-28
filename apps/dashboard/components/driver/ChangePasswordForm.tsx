'use client';
import { useState } from 'react';
import { KeyRound } from 'lucide-react';
import { authClient } from '@/lib/auth-client';
import { logPasswordChange } from '@/app/d/actions';
import { dInput, dLabel, dBtnPrimary } from './styles';

export function ChangePasswordForm() {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setErr(null);
    setOk(false);
    if (next.length < 8) return setErr('New password must be at least 8 characters');
    if (next !== confirm) return setErr("New passwords don't match");
    setBusy(true);
    const { error } = await authClient.changePassword({ currentPassword: current, newPassword: next, revokeOtherSessions: true });
    setBusy(false);
    if (error) return setErr(error.message ?? 'Could not change the password - check your current password');
    setCurrent('');
    setNext('');
    setConfirm('');
    setOk(true);
    logPasswordChange();
  }

  return (
    <div className="mt-4 space-y-4 rounded-xl border bg-surface p-4">
      <div className="flex items-center gap-2 text-sm font-semibold">
        <KeyRound size={18} className="text-brand" /> Change password
      </div>
      <div>
        <label className={dLabel}>Current password</label>
        <input type="password" className={dInput} value={current} onChange={(e) => setCurrent(e.target.value)} autoComplete="current-password" />
      </div>
      <div>
        <label className={dLabel}>New password</label>
        <input type="password" className={dInput} value={next} onChange={(e) => setNext(e.target.value)} autoComplete="new-password" />
      </div>
      <div>
        <label className={dLabel}>Confirm new password</label>
        <input type="password" className={dInput} value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" />
      </div>
      {err && <p className="wrap-anywhere text-sm text-crit">{err}</p>}
      {ok && <p className="text-sm text-ok">Password changed.</p>}
      <button type="button" onClick={submit} disabled={busy} className={dBtnPrimary}>
        {busy ? 'Saving…' : 'Save new password'}
      </button>
    </div>
  );
}
