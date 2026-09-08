/**
 * Cloudflare R2 (S3-compatible) access for POD photos, receipts, and documents.
 *
 * Uploads never pass through the server: the client (dashboard or mobile app)
 * asks `/api/uploads/presign` for a short-lived PUT URL, uploads directly to
 * R2, then references the returned `key`. Reads go through a presigned GET so
 * the bucket stays private.
 */
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const endpoint = process.env.R2_ENDPOINT; // https://<account>.r2.cloudflarestorage.com
const bucket = process.env.R2_BUCKET ?? 'big-ventures';

let _client: S3Client | null = null;
function client() {
  if (!_client) {
    _client = new S3Client({
      region: 'auto',
      endpoint,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID ?? '',
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY ?? '',
      },
    });
  }
  return _client;
}

export type UploadKind = 'pod' | 'receipt' | 'document' | 'check';

export function buildKey(kind: UploadKind, ownerId: string, filename: string): string {
  const safe = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
  const stamp = new Date().toISOString().slice(0, 10);
  return `${kind}/${stamp}/${ownerId}/${crypto.randomUUID()}-${safe}`;
}

export async function presignPut(key: string, contentType: string, maxBytes = 8_000_000) {
  const cmd = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    ContentType: contentType,
    ContentLength: undefined,
    Metadata: { maxbytes: String(maxBytes) },
  });
  const url = await getSignedUrl(client(), cmd, { expiresIn: 300 });
  return { url, key, bucket };
}

export async function presignGet(key: string, expiresIn = 3600) {
  const cmd = new GetObjectCommand({ Bucket: bucket, Key: key });
  return getSignedUrl(client(), cmd, { expiresIn });
}
