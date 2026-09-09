import { redirect } from 'next/navigation';
import { getSessionUser } from './session';
import { db, schema, eq } from '@bv/db';

export interface DriverCtx {
  userId: string;
  driverId: string;
  name: string;
}

/**
 * Guard for the web driver app (`/d/*`). Must be signed in with role `driver`
 * and have a driver profile. Office users are bounced to the dashboard.
 */
export async function requireDriver(): Promise<DriverCtx> {
  const user = await getSessionUser();
  if (!user) redirect('/login');
  if (user.status === 'suspended' || user.status === 'archived') redirect('/suspended');
  if (user.role !== 'driver') redirect('/');

  const [driver] = await db
    .select({ id: schema.drivers.id, name: schema.drivers.full_name })
    .from(schema.drivers)
    .where(eq(schema.drivers.user_id, user.id))
    .limit(1);
  if (!driver) redirect('/login');

  return { userId: user.id, driverId: driver.id, name: driver.name };
}

/** For server actions — throws instead of redirecting. */
export async function getDriver(): Promise<DriverCtx> {
  const user = await getSessionUser();
  if (!user || user.role !== 'driver') throw new Error('not a driver');
  const [driver] = await db
    .select({ id: schema.drivers.id, name: schema.drivers.full_name })
    .from(schema.drivers)
    .where(eq(schema.drivers.user_id, user.id))
    .limit(1);
  if (!driver) throw new Error('no driver profile');
  return { userId: user.id, driverId: driver.id, name: driver.name };
}
