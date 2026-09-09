'use client';
import { useState, useRef, useTransition, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { DELIVERY_ISSUE_CATEGORIES } from '@bv/core/enums';
import { uploadPod, completeDrop, arriveDrop } from '@/app/d/actions';

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

  // mark "arrived" once on mount using the current GPS fix
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
    await new Promise<void>((resolve) =>
      navigator.geolocation?.getCurrentPosition(
        (pos) => {
          fd.set('lat', String(pos.coords.latitude));
          fd.set('lng', String(pos.coords.longitude));
          resolve();
        },
        () => resolve(),
        { enableHighAccuracy: true, timeout: 6000 },
      ) ?? resolve(),
    );
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
    <div className="mt-4 space-y-4 pb-10">
      <div>
        <p className="text-sm font-medium">Proof of delivery</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {photos.map((p) => (
            <img key={p.id} src={p.url} alt="POD" className="h-20 w-20 rounded-lg object-cover" />
          ))}
          <label className="grid h-20 w-20 place-items-center rounded-lg border border-dashed border-brand text-xs font-semibold text-brand">
            {busy ? '…' : '+ Photo'}
            <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={onPhoto} />
          </label>
        </div>
      </div>

      <div>
        <label className="text-sm font-medium">Received by</label>
        <input
          className="mt-1 w-full rounded-lg border bg-surface px-3 py-2.5 text-base"
          value={signee}
          onChange={(e) => setSignee(e.target.value)}
          placeholder="Name of who signed"
        />
      </div>

      <div>
        <label className="text-sm font-medium">Any problem?</label>
        <div className="mt-2 flex flex-wrap gap-2">
          {DELIVERY_ISSUE_CATEGORIES.map((c) => (
            <button
              key={c}
              onClick={() => setIssue(issue === c ? '' : c)}
              className={`rounded-full border px-3 py-1.5 text-xs capitalize ${issue === c ? 'border-warn bg-warn text-white' : ''}`}
            >
              {c.replace('_', ' ')}
            </button>
          ))}
        </div>
        {issue && (
          <input
            className="mt-2 w-full rounded-lg border bg-surface px-3 py-2 text-sm"
            value={issueNotes}
            onChange={(e) => setIssueNotes(e.target.value)}
            placeholder="Describe it"
          />
        )}
      </div>

      {err && <p className="text-sm text-crit">{err}</p>}

      <div className="space-y-2">
        <button
          onClick={() => close('delivered')}
          disabled={pending}
          className="w-full rounded-lg bg-ok px-4 py-3 text-base font-semibold text-white disabled:opacity-60"
        >
          Delivered in full
        </button>
        <button
          onClick={() => close('partial')}
          disabled={pending}
          className="w-full rounded-lg bg-warn px-4 py-3 text-base font-semibold text-white disabled:opacity-60"
        >
          Partial delivery
        </button>
        <button
          onClick={() => close('failed')}
          disabled={pending}
          className="w-full rounded-lg bg-crit px-4 py-3 text-base font-semibold text-white disabled:opacity-60"
        >
          Failed / returned
        </button>
      </div>
    </div>
  );
}
