import { sql, eq, and, desc } from 'drizzle-orm';
import type { DB } from '../index';
import { auditLog, user } from '../schema';

export async function auditTrail(
  db: DB,
  f: { entityType?: string; actorId?: string; limit?: number } = {},
) {
  const conds = [];
  if (f.entityType) conds.push(eq(auditLog.entity_type, f.entityType));
  if (f.actorId) conds.push(eq(auditLog.actor_id, f.actorId));

  return db
    .select({
      id: auditLog.id,
      at: auditLog.at,
      actor: user.name,
      actorRole: auditLog.actor_role,
      action: auditLog.action,
      entityType: auditLog.entity_type,
      entityId: auditLog.entity_id,
      source: auditLog.source,
      after: auditLog.after,
    })
    .from(auditLog)
    .leftJoin(user, eq(user.id, auditLog.actor_id))
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(desc(auditLog.at))
    .limit(f.limit ?? 200);
}

export async function auditEntityTypes(db: DB) {
  const rows = await db
    .select({ t: auditLog.entity_type, n: sql<number>`count(*)::int` })
    .from(auditLog)
    .groupBy(auditLog.entity_type)
    .orderBy(sql`count(*) desc`);
  return rows;
}
