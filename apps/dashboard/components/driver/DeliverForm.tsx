'use client';
import { useState, useRef, useTransition, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { DELIVERY_ISSUE_CATEGORIES } from '@bv/core/enums';
import { uploadPod, completeDrop, arriveDrop } from '@/app/d/actions';
import { dInput, dLabel, dBtnOk, dBtnWarn, dBtnCrit, dChip } from './styles';

export function DeliverForm({
  dropId,
  existingPhotos,
  hasArrived,
}: {
  dropId: string;
  existingPhotos: { id: string; url: string }[];
  hasArrived: boolean;
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [photos, setPhotos] = useState(existingPhotos);
  const [signee, setSignee] = useState('');
  const [issue, setIssue] = useState('');
  const [issueNotes, setIssueNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();

  useEffect(() => {
    if (hasArrived) return;
    navigator.geolocation?.getCurrentPosition(
      (pos) => arriveDrop(dropId, pos.coords.latitude, pos.coords.longitude).catch(() => {}),
      () => arriveDrop(dropId).catch(() => {}),
      { enableHighAccuracy: true, timeout: 8000 },
    );
  }, [dropId, hasArrived]);

  async function onPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setErr(null);
    const fd = new FormData();
    fd.set('dropId', dropId);
    fd.set('file', file);
    await new Promise<void>((resolve) => {
      if (!navigator.geolocation) return resolve();
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          fd.set('lat', String(pos.coords.latitude));
          fd.set('lng', String(pos.coords.longitude));
          resolve();
        },
        () => resolve(),
        { enableHighAccuracy: true, timeout: 6000 },
      );
    });
    const r = await uploadPod(fd);
    setBusy(false);
    if (r.error) setErr(r.error);
    else {
      setPhotos((p) => [...p, { id: crypto.randomUUID(), url: URL.createObjectURL(file) }]);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  function close(status: string) {
    const fd = new FormData();
    fd.set('dropId', dropId);
    fd.set('status', status);
    fd.set('signee', signee);
    fd.set('issue', issue);
    fd.set('issueNotes', issueNotes);
    setErr(null);
    start(async () => {
      const r = await completeDrop(fd);
      if (r.error) setErr(r.error);
      else router.back();
    });
  }

  return (
    <div className="mt-4 space-y-5 pb-12">
      <div>
        <p className="text-sm font-medium">Proof of delivery</p>
        <div className="mt-2 grid grid-cols-3 gap-2">
          {photos.map((p) => (
            <img key={p.id} src={p.url} alt="POD" className="aspect-square w-full rounded-lg object-cover" />
          ))}
          <label className="grid aspect-square w-full place-items-center rounded-lg border-2 border-dashed border-brand text-xs font-semibold text-brand active:bg-brand/10">
            {busy ? 'Uploading…' : '+ Photo'}
            <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={onPhoto} />
          </label>
        </div>
      </div>

      <div>
        <label className={dLabel}>Received by</label>
        <input className={dInput} value={signee} onChange={(e) => setSignee(e.target.value)} placeholder="Name of who signed" />
      </div>

      <div>
        <label className={dLabel}>Any problem?</label>
        <div className="mt-2 flex flex-wrap gap-2">
          {DELIVERY_ISSUE_CATEGORIES.map((c) => (
            <button
              key={c}
              onClick={() => setIssue(issue === c ? '' : c)}
              className={`${dChip} capitalize ${issue === c ? 'border-warn bg-warn text-white' : ''}`}
            >
              {c.replace('_', ' ')}
            </button>
          ))}
        </div>
        {issue && (
          <input
            className={`${dInput} mt-2`}
            value={issueNotes}
            onChange={(e) => setIssueNotes(e.target.value)}
            placeholder="Describe it"
          />
        )}
      </div>

      {err && <p className="wrap-anywhere text-sm text-crit">{err}</p>}

      <div className="space-y-2.5">
        <button onClick={() => close('delivered')} disabled={pending} className={dBtnOk}>
          Delivered in full
        </button>
        <button onClick={() => close('partial')} disabled={pending} className={dBtnWarn}>
          Partial delivery
        </button>
        <button onClick={() => close('failed')} disabled={pending} className={dBtnCrit}>
          Failed / returned
        </button>
      </div>
    </div>
  );
}
