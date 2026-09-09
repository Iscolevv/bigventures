import { headers } from 'next/headers';
import { db, schema } from '@bv/db';
import type { SessionUser } from './session';
import type { AuditAction } from '@bv/core/enums';

/** Append an audit-trail row. Never throws — auditing must not break a mutation. */
export async function writeAudit(
  actor: SessionUser,
  action: AuditAction,
  entityType: string,
  entityId: string,
  before?: unknown,
  after?: unknown,
) {
  try {
    const h = await headers();
    await db.insert(schema.auditLog).values({
      actor_id: actor.id,
      actor_role: actor.role,
      action,
      entity_type: entityType,
      entity_id: entityId,
      before: (before ?? null) as object,
      after: (after ?? null) as object,
      source: 'dashboard',
      ip: h.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
      user_agent: h.get('user-agent') ?? null,
    });
  } catch (e) {
    console.error('audit write failed', e);
  }
}
