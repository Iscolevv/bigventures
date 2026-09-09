import { sql, eq, and, desc } from 'drizzle-orm';
import type { DB } from '../index';
import { auditLog, user } from '../schema';
import { pageBounds, paged, type PageArgs } from './_util';

export async function auditTrail(
  db: DB,
  f: { entityType?: string; actorId?: string } & PageArgs = {},
) {
  const conds = [];
  if (f.entityType) conds.push(eq(auditLog.entity_type, f.entityType));
  if (f.actorId) conds.push(eq(auditLog.actor_id, f.actorId));
  const where = conds.length ? and(...conds) : undefined;
  const b = pageBounds({ pageSize: 40, ...f });
  const [{ total } = { total: 0 }] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(auditLog)
    .where(where);

  const rows = await db
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
    .where(where)
    .orderBy(desc(auditLog.at))
    .limit(b.limit)
    .offset(b.offset);
  return paged(rows, total, b.page, b.pageSize);
}

export async function auditEntityTypes(db: DB) {
  const rows = await db
    .select({ t: auditLog.entity_type, n: sql<number>`count(*)::int` })
    .from(auditLog)
    .groupBy(auditLog.entity_type)
    .orderBy(sql`count(*) desc`);
  return rows;
}
