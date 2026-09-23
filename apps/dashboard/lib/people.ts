import { randomUUID } from 'node:crypto';
import { auth } from './auth';
import { db, schema, eq } from '@bv/db';
import type { Role } from '@bv/core/enums';

/** Placeholder login domain until staff have real emails; editable per person. */
export const LOGIN_DOMAIN = 'bigventures.demo';

/** The sign-in system rejects anything without a real domain (kevin@bigventures), which would lock the person out. */
export function isValidEmail(email: string) {
  return /^[^@\s]+@[^@\s.]+(\.[^@\s.]+)*\.[A-Za-z]{2,}$/.test(email.trim());
}

export function loginEmailFor(name: string) {
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '.').replace(/^\.+|\.+$/g, '');
  return `${slug}@${LOGIN_DOMAIN}`;
}

async function hash(password: string) {
  const ctx = await auth.$context;
  return ctx.password.hash(password);
}

/** Create a user with an email+password credential. Returns the new user id. */
export async function createLogin(input: { name: string; email: string; role: Role; password: string }) {
  if (!isValidEmail(input.email)) throw new Error('invalid email');
  const id = randomUUID();
  const now = new Date();
  await db.insert(schema.user).values({
    id,
    name: input.name,
    email: input.email.toLowerCase(),
    emailVerified: true,
    role: input.role,
    status: 'active',
    createdAt: now,
    updatedAt: now,
  });
  await db.insert(schema.account).values({
    id: randomUUID(),
    accountId: id,
    providerId: 'credential',
    userId: id,
    password: await hash(input.password),
    createdAt: now,
    updatedAt: now,
  });
  return id;
}

export async function setLoginPassword(userId: string, password: string) {
  const hashed = await hash(password);
  const [acc] = await db.select({ id: schema.account.id }).from(schema.account).where(eq(schema.account.userId, userId)).limit(1);
  if (acc) {
    await db.update(schema.account).set({ password: hashed, updatedAt: new Date() }).where(eq(schema.account.id, acc.id));
  } else {
    await db.insert(schema.account).values({
      id: randomUUID(), accountId: userId, providerId: 'credential', userId, password: hashed,
      createdAt: new Date(), updatedAt: new Date(),
    });
  }
}

/** A driver = a login (role driver) + a driver profile. Only the name is required. */
export async function createDriver(input: { name: string; password: string; email?: string; vehicleId?: string | null; assignedBy?: string }) {
  const userId = await createLogin({
    name: input.name,
    email: input.email?.trim() || loginEmailFor(input.name),
    role: 'driver',
    password: input.password,
  });
  const driverId = randomUUID();
  await db.insert(schema.drivers).values({ id: driverId, user_id: userId, full_name: input.name, status: 'active' });
  if (input.vehicleId) await assignVehicle(driverId, input.vehicleId, input.assignedBy);
  return { userId, driverId };
}

/** Close any open assignment for this vehicle and this driver, then open the new one. */
export async function assignVehicle(driverId: string, vehicleId: string, assignedBy?: string) {
  const today = new Date().toISOString().slice(0, 10);
  await db.execute(
    (await import('@bv/db')).sql`update bigventures.vehicle_assignments set end_date = ${today}
      where end_date is null and (vehicle_id = ${vehicleId} or driver_id = ${driverId})`,
  );
  await db.insert(schema.vehicleAssignments).values({
    vehicle_id: vehicleId, driver_id: driverId, start_date: today, assigned_by: assignedBy ?? null,
  });
}

export async function unassignDriver(driverId: string) {
  const today = new Date().toISOString().slice(0, 10);
  await db.execute(
    (await import('@bv/db')).sql`update bigventures.vehicle_assignments set end_date = ${today}
      where end_date is null and driver_id = ${driverId}`,
  );
}

export async function unassignVehicle(vehicleId: string) {
  const today = new Date().toISOString().slice(0, 10);
  await db.execute(
    (await import('@bv/db')).sql`update bigventures.vehicle_assignments set end_date = ${today}
      where end_date is null and vehicle_id = ${vehicleId}`,
  );
}
