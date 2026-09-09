import { NextResponse } from 'next/server';
import { getMobileActor } from '@/lib/mobile-auth';
import { buildKey, uploadObject, storageConfigured, type UploadKind } from '@/lib/storage';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const OK = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'application/pdf']);
const MAX = 10 * 1024 * 1024;

/**
 * The driver app POSTs a compressed photo / receipt / document here as
 * multipart form-data (`file`, `kind`). Server-side upload to Blob/R2; returns
 * the storage key the sync batch then references.
 */
export async function POST(req: Request) {
  const actor = await getMobileActor();
  if (!actor) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (!storageConfigured()) {
    return NextResponse.json({ error: 'storage not configured' }, { status: 503 });
  }

  const form = await req.formData().catch(() => null);
  const file = form?.get('file');
  const kind = String(form?.get('kind') ?? 'pod') as UploadKind;
  if (!(file instanceof File)) return NextResponse.json({ error: 'no file' }, { status: 400 });
  if (file.size > MAX) return NextResponse.json({ error: 'too large' }, { status: 413 });
  if (!OK.has(file.type)) return NextResponse.json({ error: `bad type ${file.type}` }, { status: 415 });

  const key = buildKey(kind, actor.driverId, file.name || `${kind}.jpg`);
  const stored = await uploadObject(key, file.type, await file.arrayBuffer());
  return NextResponse.json({ key: stored.url.startsWith('http') ? stored.url : stored.key, url: stored.url });
}
