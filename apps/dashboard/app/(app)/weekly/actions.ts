'use server';
import { revalidatePath } from 'next/cache';
import { requirePermission } from '@/lib/session';
import { db, sql } from '@bv/db';

/** Type a status word ("PKD JGRD", "GARAGED"...) into a truck's day on the weekly sheet. Blank clears it. */
export async function setDayNote(vehicleId: string, day: string, note: string) {
  const user = await requirePermission('vehicle:update');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return { error: 'Bad date' };
  const text = note.trim().toUpperCase().slice(0, 40);
  if (!text) {
    await db.execute(sql`delete from bigventures.vehicle_day_notes where vehicle_id = ${vehicleId} and day = ${day}::date`);
  } else {
    await db.execute(sql`
      insert into bigventures.vehicle_day_notes (vehicle_id, day, note, updated_by)
      values (${vehicleId}, ${day}::date, ${text}, ${user.id})
      on conflict (vehicle_id, day) do update set note = excluded.note, updated_by = excluded.updated_by, updated_at = now()`);
  }
  revalidatePath('/weekly');
  return { ok: true };
}
