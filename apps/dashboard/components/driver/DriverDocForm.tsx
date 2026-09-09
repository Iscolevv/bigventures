'use client';
import { useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { uploadDriverDoc } from '@/app/d/actions';

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
    <div className="mt-2 space-y-2">
      <input ref={fileRef} type="file" accept="image/*,application/pdf" capture="environment" className="block w-full text-xs" />
      {hasExpiry && (
        <div className="flex gap-2">
          <input type="date" className="flex-1 rounded-lg border bg-bg px-2 py-1.5 text-xs" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} aria-label="issue date" />
          <input type="date" className="flex-1 rounded-lg border bg-bg px-2 py-1.5 text-xs" value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)} aria-label="expiry date" />
        </div>
      )}
      <button onClick={submit} disabled={pending} className="rounded-lg bg-brand px-3 py-1.5 text-sm font-medium text-white disabled:opacity-60">
        {pending ? 'Uploading…' : replace ? 'Replace' : 'Upload'}
      </button>
      {msg && <span className="ml-2 text-xs text-muted">{msg}</span>}
    </div>
  );
}
