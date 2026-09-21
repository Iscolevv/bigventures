'use server';
import { revalidatePath } from 'next/cache';
import { requirePermission } from '@/lib/session';
import { writeAudit } from '@/lib/audit';
import { db, schema, eq } from '@bv/db';

/**
 * Removing a PO photo is a supervisor-only action (operations/admin hold
 * `pod:delete`). Drivers can add a photo but never remove one. The removal is
 * written to the audit trail with the file reference so it can be traced.
 */
export async function removePodPhoto(photoId: string) {
  const user = await requirePermission('pod:delete');
  const [photo] = await db
    .select({
      id: schema.podPhotos.id,
      dropId: schema.podPhotos.drop_id,
      key: schema.podPhotos.storage_key,
      tripId: schema.drops.trip_id,
      po: schema.drops.po_number,
    })
    .from(schema.podPhotos)
    .innerJoin(schema.drops, eq(schema.drops.id, schema.podPhotos.drop_id))
    .where(eq(schema.podPhotos.id, photoId))
    .limit(1);
  if (!photo) return { error: 'Photo not found' };

  await db.delete(schema.podPhotos).where(eq(schema.podPhotos.id, photoId));
  await writeAudit(user, 'delete', 'pod_photo', photoId, { dropId: photo.dropId, po: photo.po, key: photo.key }, null);
  revalidatePath(`/trips/${photo.tripId}`);
  return { ok: true };
}
