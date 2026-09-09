/**
 * File storage abstraction for POD photos, fuel receipts, and compliance
 * documents. Two backends, picked by which env vars are set:
 *
 *   Vercel Blob  — set BLOB_READ_WRITE_TOKEN (Vercel injects this once you add
 *                  a Blob store in the dashboard). Zero external setup. Default.
 *   Cloudflare R2 — set R2_ENDPOINT + R2_BUCKET + R2_ACCESS_KEY_ID +
 *                  R2_SECRET_ACCESS_KEY. Cheaper at photo scale, S3-compatible.
 *
 * If neither is configured, uploads throw a clear error rather than failing
 * silently.
 */
import { put } from '@vercel/blob';

export type UploadKind = 'pod' | 'receipt' | 'document' | 'check';

const useBlob = () => !!process.env.BLOB_READ_WRITE_TOKEN;
const useR2 = () =>
  !!process.env.R2_ENDPOINT &&
  !!process.env.R2_ACCESS_KEY_ID &&
  !!process.env.R2_SECRET_ACCESS_KEY;

export function storageConfigured(): boolean {
  return useBlob() || useR2();
}

export function storageBackend(): 'vercel-blob' | 'cloudflare-r2' | 'none' {
  if (useBlob()) return 'vercel-blob';
  if (useR2()) return 'cloudflare-r2';
  return 'none';
}

export function buildKey(kind: UploadKind, ownerId: string, filename: string): string {
  const safe = filename.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 120);
  const stamp = new Date().toISOString().slice(0, 10);
  return `${kind}/${stamp}/${ownerId}/${crypto.randomUUID()}-${safe}`;
}

export interface StoredObject {
  key: string;
  url: string;
}

/** Upload bytes server-side. Returns the storage key + a readable URL. */
export async function uploadObject(
  key: string,
  contentType: string,
  body: Buffer | Uint8Array | ArrayBuffer,
): Promise<StoredObject> {
  const bytes: Buffer =
    body instanceof ArrayBuffer ? Buffer.from(body) : Buffer.from(body as Uint8Array);

  if (useBlob()) {
    const res = await put(key, bytes, {
      access: 'public',
      contentType,
      token: process.env.BLOB_READ_WRITE_TOKEN,
      addRandomSuffix: false,
    });
    return { key, url: res.url };
  }

  if (useR2()) {
    const { S3Client, PutObjectCommand } = await import('@aws-sdk/client-s3');
    const { getSignedUrl } = await import('@aws-sdk/s3-request-presigner');
    const client = new S3Client({
      region: 'auto',
      endpoint: process.env.R2_ENDPOINT,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID!,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
      },
    });
    const bucket = process.env.R2_BUCKET ?? 'big-ventures';
    await client.send(
      new PutObjectCommand({ Bucket: bucket, Key: key, Body: bytes, ContentType: contentType }),
    );
    const url = process.env.R2_PUBLIC_BASE_URL
      ? `${process.env.R2_PUBLIC_BASE_URL}/${key}`
      : await getSignedUrl(client, new PutObjectCommand({ Bucket: bucket, Key: key }), { expiresIn: 3600 });
    return { key, url };
  }

  throw new Error(
    'No file storage configured. Add a Vercel Blob store (sets BLOB_READ_WRITE_TOKEN) or set the R2_* env vars.',
  );
}

/** Readable URL for a stored key. Vercel Blob keys are already public URLs-ish. */
export async function objectUrl(key: string): Promise<string | null> {
  if (!key) return null;
  if (key.startsWith('http')) return key;
  if (useR2() && process.env.R2_PUBLIC_BASE_URL) return `${process.env.R2_PUBLIC_BASE_URL}/${key}`;
  if (useR2()) {
    const { S3Client, GetObjectCommand } = await import('@aws-sdk/client-s3');
    const { getSignedUrl } = await import('@aws-sdk/s3-request-presigner');
    const client = new S3Client({
      region: 'auto',
      endpoint: process.env.R2_ENDPOINT,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID!,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
      },
    });
    return getSignedUrl(
      client,
      new GetObjectCommand({ Bucket: process.env.R2_BUCKET ?? 'big-ventures', Key: key }),
      { expiresIn: 3600 },
    );
  }
  return null; // Vercel Blob: the stored value is the URL; nothing to sign
}
