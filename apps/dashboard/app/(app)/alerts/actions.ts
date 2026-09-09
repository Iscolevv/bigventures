'use server';
import { revalidatePath } from 'next/cache';
import { requirePermission } from '@/lib/session';
import { writeAudit } from '@/lib/audit';
import { db, schema, eq } from '@bv/db';
import { runAlertScan } from '@/lib/alert-engine';

export async function setAlertStatus(
  alertId: string,
  status: 'acknowledged' | 'resolved' | 'dismissed',
  notes?: string,
) {
  const user = await requirePermission('alert:update');
  await db
    .update(schema.alerts)
    .set({
      status,
      acknowledged_by: status === 'acknowledged' ? user.id : undefined,
      acknowledged_at: status === 'acknowledged' ? new Date() : undefined,
      resolved_by: status === 'resolved' || status === 'dismissed' ? user.id : undefined,
      resolved_at: status === 'resolved' || status === 'dismissed' ? new Date() : undefined,
      resolution_notes: notes,
    })
    .where(eq(schema.alerts.id, alertId));
  await writeAudit(user, 'update', 'alert', alertId, null, { status });
  revalidatePath('/alerts');
  return { ok: true };
}

export async function rescan() {
  await requirePermission('alert:update');
  const n = await runAlertScan(db);
  revalidatePath('/alerts');
  return { ok: true, raised: n };
}
