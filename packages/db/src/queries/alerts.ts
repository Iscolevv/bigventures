import { sql, eq, and, inArray, desc } from 'drizzle-orm';
import type { DB } from '../index';
import { alerts, documents, drivers, vehicles } from '../schema';
import { money, pageBounds, paged, type PageArgs, type Paged } from './_util';

export async function openAlerts(db: DB, args: PageArgs & { type?: string } = {}) {
  const where = args.type
    ? and(inArray(alerts.status, ['open', 'acknowledged']), eq(alerts.type, args.type as 'failed_check'))
    : inArray(alerts.status, ['open', 'acknowledged']);
  const b = pageBounds({ pageSize: 30, ...args });
  const [{ total } = { total: 0 }] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(alerts)
    .where(where);
  const rows = await db
    .select()
    .from(alerts)
    .where(where)
    .orderBy(
      sql`case ${alerts.severity} when 'critical' then 0 when 'warning' then 1 else 2 end`,
      desc(alerts.raised_at),
    )
    .limit(b.limit)
    .offset(b.offset);
  return paged(rows, total, b.page, b.pageSize);
}

export async function alertCounts(db: DB) {
  const rows = await db
    .select({
      type: alerts.type,
      severity: alerts.severity,
      n: sql<number>`count(*)::int`,
    })
    .from(alerts)
    .where(inArray(alerts.status, ['open', 'acknowledged']))
    .groupBy(alerts.type, alerts.severity);
  const byType: Record<string, number> = {};
  let critical = 0;
  let warning = 0;
  for (const r of rows) {
    byType[r.type] = (byType[r.type] ?? 0) + r.n;
    if (r.severity === 'critical') critical += r.n;
    if (r.severity === 'warning') warning += r.n;
  }
  return { total: critical + warning + rows.filter((r) => r.severity === 'info').reduce((s, r) => s + r.n, 0), critical, warning, byType };
}

// ---- Documents --------------------------------------------------

export interface DocRow {
  id: string;
  ownerType: string;
  ownerName: string;
  docType: string;
  title: string;
  issueDate: string | null;
  expiryDate: string | null;
  status: string;
  daysToExpiry: number | null;
}

export async function documentList(
  db: DB,
  args: PageArgs & { ownerType?: string } = {},
): Promise<Paged<DocRow>> {
  const where = args.ownerType
    ? eq(documents.owner_type, args.ownerType as 'driver')
    : undefined;
  const b = pageBounds({ pageSize: 30, ...args });
  const [{ total } = { total: 0 }] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(documents)
    .where(where);
  const rows = await db
    .select({
      id: documents.id,
      ownerType: documents.owner_type,
      ownerId: documents.owner_id,
      docType: documents.doc_type,
      title: documents.title,
      issueDate: documents.issue_date,
      expiryDate: documents.expiry_date,
      status: documents.status,
      driverName: drivers.full_name,
      vehicleReg: vehicles.registration,
    })
    .from(documents)
    .leftJoin(drivers, and(eq(documents.owner_type, 'driver'), eq(drivers.id, documents.owner_id)))
    .leftJoin(vehicles, and(eq(documents.owner_type, 'vehicle'), eq(vehicles.id, documents.owner_id)))
    .where(where)
    .orderBy(sql`${documents.expiry_date} asc nulls last`)
    .limit(b.limit)
    .offset(b.offset);

  const now = Date.now();
  const mapped = rows.map((r) => ({
    id: r.id,
    ownerType: r.ownerType,
    ownerName: r.driverName ?? r.vehicleReg ?? 'Company',
    docType: r.docType,
    title: r.title,
    issueDate: r.issueDate,
    expiryDate: r.expiryDate,
    status: r.status,
    daysToExpiry: r.expiryDate
      ? Math.round((new Date(r.expiryDate).getTime() - now) / 86_400_000)
      : null,
  }));
  return paged(mapped, total, b.page, b.pageSize);
}

/** Document status counts across the whole set (for the page header tiles). */
export async function documentSummary(db: DB) {
  const [r] = await db
    .select({
      total: sql<number>`count(*)::int`,
      expired: sql<number>`count(*) filter (where ${documents.status} = 'expired' or (${documents.expiry_date} is not null and ${documents.expiry_date} < current_date))::int`,
      expiring: sql<number>`count(*) filter (where ${documents.expiry_date} is not null and ${documents.expiry_date} >= current_date and ${documents.expiry_date} < current_date + 45)::int`,
      pending: sql<number>`count(*) filter (where ${documents.status} = 'pending_review')::int`,
    })
    .from(documents);
  return {
    total: r?.total ?? 0,
    expired: r?.expired ?? 0,
    expiring: r?.expiring ?? 0,
    pending: r?.pending ?? 0,
  };
}

export { money };
