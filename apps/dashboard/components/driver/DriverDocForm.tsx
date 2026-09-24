'use client';
import { CheckCircle2, Upload, XCircle } from 'lucide-react';
import { useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { uploadDriverDoc } from '@/app/d/actions';
import { dInput } from './styles';
import { compressImage } from './imageCompress';

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
    setMsg(null);
    start(async () => {
      const fd = new FormData();
      fd.set('docType', docType);
      // documents need to stay legible (small print, dates) - less aggressive than a POD photo
      fd.set('file', await compressImage(f, { maxDim: 2000, quality: 0.82 }));
      if (issueDate) fd.set('issueDate', issueDate);
      if (expiryDate) fd.set('expiryDate', expiryDate);
      const r = await uploadDriverDoc(fd);
      if (r.error) setMsg(`ERR:${r.error}`);
      else {
        setMsg('OK:Sent for review');
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
        className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white active:opacity-90 disabled:opacity-60"
      >
        <Upload size={16} />
        {pending ? 'Uploading…' : replace ? 'Replace' : 'Upload'}
      </button>
      {msg && (
        <span className={`wrap-anywhere ml-2 inline-flex items-center gap-1 text-xs ${msg.startsWith('OK:') ? 'text-ok' : msg.startsWith('ERR:') ? 'text-crit' : 'text-muted'}`}>
          {msg.startsWith('OK:') && <CheckCircle2 size={14} />}
          {msg.startsWith('ERR:') && <XCircle size={14} />}
          {msg.replace(/^(OK|ERR):/, '')}
        </span>
      )}
    </div>
  );
}
