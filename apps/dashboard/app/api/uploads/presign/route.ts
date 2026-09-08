import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSessionUser } from '@/lib/session';
import { getMobileActor } from '@/lib/mobile-auth';
import { buildKey, presignPut, type UploadKind } from '@/lib/r2';

const bodySchema = z.object({
  kind: z.enum(['pod', 'receipt', 'document', 'check']),
  filename: z.string().min(1).max(200),
  contentType: z.string().min(3).max(120),
});

const ALLOWED_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'application/pdf',
]);

export async function POST(req: Request) {
  const dashUser = await getSessionUser();
  const mobile = dashUser ? null : await getMobileActor();
  const ownerId = dashUser?.id ?? mobile?.driverId;
  if (!ownerId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'invalid body' }, { status: 400 });

  const { kind, filename, contentType } = parsed.data;
  if (!ALLOWED_TYPES.has(contentType)) {
    return NextResponse.json({ error: 'unsupported content type' }, { status: 415 });
  }

  const key = buildKey(kind as UploadKind, ownerId, filename);
  const { url, bucket } = await presignPut(key, contentType);
  return NextResponse.json({ url, key, bucket, expiresIn: 300 });
}
