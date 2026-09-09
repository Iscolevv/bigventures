/**
 * Role-based access control for Big Ventures.
 *
 * Two layers, both enforced server-side:
 *
 *  1. Capability check  — `can(role, 'trip:approve')`. Coarse "is this role
 *     allowed to perform this action at all".
 *  2. Row scope         — `rowScope(role)`. Whether the actor is limited to
 *     rows tied to their own driver record. The query layer in `@bv/db`
 *     turns `'own'` into a `WHERE driver_id = $me` clause.
 *
 * The client (dashboard / mobile) may use `can()` to hide UI, but every
 * mutation and query path re-checks on the server. Never trust the client.
 */

import type { Role } from './enums';

export const RESOURCES = [
  'vehicle',
  'driver',
  'trip',
  'drop',
  'pod',
  'vehicle_check',
  'fuel',
  'cost',
  'advance',
  'payroll',
  'incentive_rule',
  'client',
  'invoice',
  'payment',
  'document',
  'alert',
  'audit',
  'report',
  'user',
  'settings',
] as const;
export type Resource = (typeof RESOURCES)[number];

export const ACTIONS = [
  'create',
  'read',
  'update',
  'delete',
  'approve',
  'override',
  'export',
] as const;
export type Action = (typeof ACTIONS)[number];

export type Permission = `${Resource}:${Action}` | `${Resource}:*` | '*';

/**
 * What each role can do. `'<resource>:*'` grants every action on that
 * resource; `'*'` grants everything (admin only).
 *
 * Keep this list boring and explicit — it is the security surface.
 */
export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  driver: [
    // A driver operates only on their own trips and their own uploads.
    'trip:create',
    'trip:read',
    'trip:update', // only while draft/in_progress and only own — enforced by rowScope + status guard
    'drop:read',
    'drop:update',
    'pod:create',
    'pod:read',
    'vehicle_check:create',
    'vehicle_check:read',
    'fuel:create',
    'fuel:read',
    'document:create', // upload own compliance docs
    'document:read',
    'vehicle:read', // only assigned vehicle(s)
    'advance:read', // own balance only
    'alert:read', // alerts addressed to them
  ],

  operations: [
    // Kevin: full operational + financial control, can override.
    'vehicle:*',
    'driver:*',
    'trip:*',
    'drop:*',
    'pod:*',
    'vehicle_check:*',
    'fuel:*',
    'cost:*',
    'advance:*',
    'payroll:*',
    'incentive_rule:read',
    'incentive_rule:update',
    'client:*',
    'invoice:*',
    'payment:*',
    'document:*',
    'alert:*',
    'audit:read',
    'report:read',
    'report:export',
    'user:read',
    'settings:read',
    'settings:update',
  ],

  management: [
    // Raha + directors: read/report everywhere, tune incentive rules only.
    'vehicle:read',
    'driver:read',
    'trip:read',
    'drop:read',
    'pod:read',
    'vehicle_check:read',
    'fuel:read',
    'cost:read',
    'advance:read',
    'payroll:read',
    'payroll:approve',
    'incentive_rule:*',
    'client:read',
    'invoice:read',
    'invoice:approve',
    'payment:read',
    'document:read',
    'alert:read',
    'alert:update', // acknowledge / dismiss
    'audit:read',
    'report:read',
    'report:export',
    'user:read',
    'settings:read',
  ],

  admin: ['*'],
};

/** Row-visibility scope for a role. */
export type RowScope = 'own' | 'all';

const OWN_SCOPED_ROLES: ReadonlySet<Role> = new Set<Role>(['driver']);

export function rowScope(role: Role): RowScope {
  return OWN_SCOPED_ROLES.has(role) ? 'own' : 'all';
}

function permMatches(granted: Permission, wanted: Permission): boolean {
  if (granted === '*') return true;
  if (granted === wanted) return true;
  const [gRes, gAct] = granted.split(':');
  const [wRes, wAct] = wanted.split(':');
  return gRes === wRes && gAct === '*' && wAct !== undefined;
}

/** Coarse capability check. */
export function can(role: Role, permission: Exclude<Permission, `${string}:*` | '*'>): boolean {
  const grants = ROLE_PERMISSIONS[role] ?? [];
  return grants.some((g) => permMatches(g, permission));
}

/** Throwing variant for server route guards. */
export class ForbiddenError extends Error {
  readonly status = 403;
  constructor(permission: string) {
    super(`Missing permission: ${permission}`);
    this.name = 'ForbiddenError';
  }
}

export function assertCan(
  role: Role,
  permission: Exclude<Permission, `${string}:*` | '*'>,
): void {
  if (!can(role, permission)) throw new ForbiddenError(permission);
}

/**
 * Statuses in which a driver is still allowed to mutate their own trip.
 * Once a trip is `completed`/`cancelled`/`flagged` only ops/admin may touch it.
 */
export const DRIVER_MUTABLE_TRIP_STATUSES = ['draft', 'pre_check', 'in_progress'] as const;
