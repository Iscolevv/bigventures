import { headers } from 'next/headers';
import { auth } from './auth';
import { db, schema, eq } from '@bv/db';

export interface MobileActor {
  userId: string;
  driverId: string;
  deviceId: string | null;
}

/**
 * The Expo app authenticates against the same Better Auth backend and sends its
 * session token as a Bearer header. Resolve it to a driver, or return null.
 */
export async function getMobileActor(): Promise<MobileActor | null> {
  const h = await headers();
  const session = await auth.api.getSession({ headers: h });
  if (!session?.user) return null;
  if ((session.user as { role?: string }).role !== 'driver') return null;

  const rows = await db
    .select({ id: schema.drivers.id })
    .from(schema.drivers)
    .where(eq(schema.drivers.user_id, session.user.id))
    .limit(1);
  const driver = rows[0];
  if (!driver) return null;

  return {
    userId: session.user.id,
    driverId: driver.id,
    deviceId: h.get('x-device-id'),
  };
}
