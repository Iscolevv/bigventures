'use client';
import { Camera } from 'lucide-react';
import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { uploadPod } from '@/app/d/actions';
import { compressImage } from './imageCompress';
import { dBtnPrimary } from './styles';

/** Adds the PO photo to a drop that's already been logged. Drivers can add, never remove. */
export function PodUpload({ dropId }: { dropId: string }) {
  const router = useRouter();
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const original = e.target.files?.[0];
    if (!original) return;
    setBusy(true);
    setErr(null);
    const fd = new FormData();
    fd.set('dropId', dropId);
    fd.set('file', await compressImage(original));
    const r = await uploadPod(fd);
    setBusy(false);
    if (r.error) setErr(r.error);
    else router.refresh();
    if (ref.current) ref.current.value = '';
  }

  return (
    <div className="mt-3">
      <button type="button" className={dBtnPrimary} disabled={busy} onClick={() => ref.current?.click()}>
        <Camera size={20} />
        {busy ? 'Uploading…' : 'Upload PO photo'}
      </button>
      <input ref={ref} type="file" accept="image/*" capture="environment" className="hidden" onChange={onFile} />
      {err && <p className="wrap-anywhere mt-2 text-sm text-crit">{err}</p>}
    </div>
  );
}
