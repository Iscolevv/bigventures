import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { auth, type AppRole } from './auth';
import { can, rowScope, ForbiddenError, type Permission } from '@bv/core/rbac';

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  role: AppRole;
  status: string;
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return null;
  const u = session.user as unknown as SessionUser;
  return { id: u.id, name: u.name, email: u.email, role: u.role, status: u.status };
}

/** Server-component / route guard: must be signed in, returns the user. */
export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect('/login');
  if (user.status === 'suspended' || user.status === 'archived') redirect('/suspended');
  return user;
}

/** The dashboard is for office roles; drivers use the mobile app. */
export async function requireDashboardUser(): Promise<SessionUser> {
  const user = await requireUser();
  if (user.role === 'driver') redirect('/mobile-only');
  return user;
}

export async function requirePermission(
  permission: Exclude<Permission, `${string}:*` | '*'>,
): Promise<SessionUser> {
  const user = await requireUser();
  if (!can(user.role, permission)) throw new ForbiddenError(permission);
  return user;
}

export { can, rowScope };
