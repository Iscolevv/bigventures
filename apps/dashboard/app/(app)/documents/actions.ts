'use server';
import { revalidatePath } from 'next/cache';
import { requirePermission } from '@/lib/session';
import { writeAudit } from '@/lib/audit';
import { db, schema, eq } from '@bv/db';
import { DOCUMENT_TYPE_BY_KEY } from '@bv/core/reference';
import { buildKey, uploadObject, storageConfigured } from '@/lib/storage';

const MAX_BYTES = 8 * 1024 * 1024;
const OK_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'application/pdf']);

export async function uploadDocumentAction(formData: FormData) {
  const user = await requirePermission('document:create');
  if (!storageConfigured()) {
    return { error: 'File storage is not set up yet — add a Vercel Blob store (see docs/SETUP.md).' };
  }

  const file = formData.get('file');
  const docType = String(formData.get('docType') ?? '');
  const ownerType = String(formData.get('ownerType') ?? '');
  const ownerId = (formData.get('ownerId') ? String(formData.get('ownerId')) : null) || null;
  const issueDate = formData.get('issueDate') ? String(formData.get('issueDate')) : null;
  const expiryDate = formData.get('expiryDate') ? String(formData.get('expiryDate')) : null;

  if (!(file instanceof File)) return { error: 'No file' };
  if (file.size > MAX_BYTES) return { error: 'File too large (max 8 MB)' };
  if (!OK_TYPES.has(file.type)) return { error: `Unsupported file type: ${file.type}` };
  const def = DOCUMENT_TYPE_BY_KEY[docType as keyof typeof DOCUMENT_TYPE_BY_KEY];
  if (!def) return { error: 'Unknown document type' };
  if (!['driver', 'vehicle', 'company'].includes(ownerType)) return { error: 'Bad owner type' };
  if (ownerType !== 'company' && !ownerId) return { error: 'Pick who this document belongs to' };

  const key = buildKey('document', ownerId ?? 'company', file.name);
  const stored = await uploadObject(key, file.type, await file.arrayBuffer());

  const ownerName =
    ownerType === 'driver'
      ? (await db.select({ n: schema.drivers.full_name }).from(schema.drivers).where(eq(schema.drivers.id, ownerId!)).limit(1))[0]?.n
      : ownerType === 'vehicle'
        ? (await db.select({ n: schema.vehicles.registration }).from(schema.vehicles).where(eq(schema.vehicles.id, ownerId!)).limit(1))[0]?.n
        : 'Company';

  const [row] = await db
    .insert(schema.documents)
    .values({
      owner_type: ownerType as 'driver',
      owner_id: ownerId,
      doc_type: docType as 'drivers_license',
      title: `${ownerName ?? 'Unknown'} — ${def.label}`,
      storage_key: stored.url.startsWith('http') ? stored.url : stored.key,
      mime_type: file.type,
      file_size: file.size,
      issue_date: issueDate,
      expiry_date: expiryDate,
      status: def.hasExpiry && !expiryDate ? 'pending_review' : 'valid',
      uploaded_by: user.id,
      uploaded_by_role: user.role,
    })
    .returning({ id: schema.documents.id });

  await writeAudit(user, 'create', 'document', row!.id, null, { docType, ownerType, ownerId });
  revalidatePath('/documents');
  return { ok: true };
}

export async function reviewDocument(docId: string, decision: 'valid' | 'rejected', notes?: string) {
  const user = await requirePermission('document:update');
  await db
    .update(schema.documents)
    .set({
      status: decision,
      reviewed_by: user.id,
      reviewed_at: new Date(),
      review_notes: notes,
      updated_at: new Date(),
    })
    .where(eq(schema.documents.id, docId));
  await writeAudit(user, decision === 'valid' ? 'approve' : 'reject', 'document', docId, null, { decision });
  revalidatePath('/documents');
  return { ok: true };
}
