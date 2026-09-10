'use client';
import { useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { uploadDriverDoc } from '@/app/d/actions';
import { dInput } from './styles';

export function DriverDocForm({
  docType,
  hasExpiry,
  replace,
}: {
  docType: string;
  hasExpiry: boolean;
  replace: boolean;
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [issueDate, setIssueDate] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function submit() {
    const f = fileRef.current?.files?.[0];
    if (!f) return setMsg('Choose or take a photo');
    const fd = new FormData();
    fd.set('docType', docType);
    fd.set('file', f);
    if (issueDate) fd.set('issueDate', issueDate);
    if (expiryDate) fd.set('expiryDate', expiryDate);
    setMsg(null);
    start(async () => {
      const r = await uploadDriverDoc(fd);
      if (r.error) setMsg(`✗ ${r.error}`);
      else {
        setMsg('✓ Sent for review');
        if (fileRef.current) fileRef.current.value = '';
        router.refresh();
      }
    });
  }

  return (
    <div className="mt-2.5 space-y-2.5">
      <input ref={fileRef} type="file" accept="image/*,application/pdf" capture="environment" className="block w-full text-sm" />
      {hasExpiry && (
        <div className="grid grid-cols-2 gap-2">
          <label className="text-xs text-muted">
            Issued
            <input type="date" className={dInput} value={issueDate} onChange={(e) => setIssueDate(e.target.value)} />
          </label>
          <label className="text-xs text-muted">
            Expires
            <input type="date" className={dInput} value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)} />
          </label>
        </div>
      )}
      <button
        onClick={submit}
        disabled={pending}
        className="min-h-[44px] rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-white active:opacity-90 disabled:opacity-60"
      >
        {pending ? 'Uploading…' : replace ? 'Replace' : 'Upload'}
      </button>
      {msg && <span className="wrap-anywhere ml-2 text-xs text-muted">{msg}</span>}
    </div>
  );
}
