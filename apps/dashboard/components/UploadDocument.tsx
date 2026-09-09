'use client';
import { useState, useRef, useTransition } from 'react';
import { DOCUMENT_TYPE_DEFS } from '@bv/core/reference';
import { uploadDocumentAction } from '@/app/(app)/documents/actions';

type Ref = { id: string; name: string };

export function UploadDocument({ drivers, vehicles }: { drivers: Ref[]; vehicles: Ref[] }) {
  const [open, setOpen] = useState(false);
  const [ownerType, setOwnerType] = useState<'driver' | 'vehicle' | 'company'>('driver');
  const [ownerId, setOwnerId] = useState('');
  const [docType, setDocType] = useState('');
  const [issueDate, setIssueDate] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [pending, start] = useTransition();

  const typeOptions = DOCUMENT_TYPE_DEFS.filter((d) => d.owner === ownerType);
  const owners = ownerType === 'driver' ? drivers : ownerType === 'vehicle' ? vehicles : [];
  const field = 'mt-1 w-full rounded-md border bg-bg px-2 py-1.5 text-sm';

  function submit() {
    const file = fileRef.current?.files?.[0];
    if (!file) return setMsg('Choose a file');
    if (!docType) return setMsg('Pick a document type');
    if (ownerType !== 'company' && !ownerId) return setMsg('Pick the owner');
    const fd = new FormData();
    fd.set('file', file);
    fd.set('docType', docType);
    fd.set('ownerType', ownerType);
    if (ownerId) fd.set('ownerId', ownerId);
    if (issueDate) fd.set('issueDate', issueDate);
    if (expiryDate) fd.set('expiryDate', expiryDate);
    setMsg(null);
    start(async () => {
      const r = await uploadDocumentAction(fd);
      if (r.error) setMsg(`✗ ${r.error}`);
      else {
        setMsg('✓ Uploaded');
        setOpen(false);
        if (fileRef.current) fileRef.current.value = '';
        setDocType('');
        setIssueDate('');
        setExpiryDate('');
      }
    });
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="rounded-md bg-brand px-3 py-1.5 text-sm font-medium text-white">
        Upload document
      </button>
    );
  }

  return (
    <div className="w-80 rounded-xl border bg-surface p-4 shadow-lg">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Upload document</h3>
        <button onClick={() => setOpen(false)} className="text-muted">
          ✕
        </button>
      </div>

      <label className="mt-3 block text-xs font-medium">Belongs to</label>
      <select
        className={field}
        value={ownerType}
        onChange={(e) => {
          setOwnerType(e.target.value as 'driver');
          setOwnerId('');
          setDocType('');
        }}
      >
        <option value="driver">Driver</option>
        <option value="vehicle">Vehicle</option>
        <option value="company">Company</option>
      </select>

      {ownerType !== 'company' && (
        <>
          <label className="mt-2 block text-xs font-medium">{ownerType === 'driver' ? 'Driver' : 'Vehicle'}</label>
          <select className={field} value={ownerId} onChange={(e) => setOwnerId(e.target.value)}>
            <option value="">Select…</option>
            {owners.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
        </>
      )}

      <label className="mt-2 block text-xs font-medium">Document type</label>
      <select className={field} value={docType} onChange={(e) => setDocType(e.target.value)}>
        <option value="">Select…</option>
        {typeOptions.map((t) => (
          <option key={t.type} value={t.type}>
            {t.label}
          </option>
        ))}
      </select>

      <div className="mt-2 grid grid-cols-2 gap-2">
        <div>
          <label className="block text-xs font-medium">Issue date</label>
          <input type="date" className={field} value={issueDate} onChange={(e) => setIssueDate(e.target.value)} />
        </div>
        <div>
          <label className="block text-xs font-medium">Expiry date</label>
          <input type="date" className={field} value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)} />
        </div>
      </div>

      <label className="mt-2 block text-xs font-medium">File (JPG / PNG / PDF, ≤ 8 MB)</label>
      <input ref={fileRef} type="file" accept="image/*,application/pdf" className="mt-1 w-full text-xs" />

      {msg && <p className="mt-2 text-xs text-muted">{msg}</p>}

      <button
        onClick={submit}
        disabled={pending}
        className="mt-3 w-full rounded-md bg-brand px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
      >
        {pending ? 'Uploading…' : 'Upload'}
      </button>
    </div>
  );
}
