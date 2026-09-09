import { sql, eq, and, inArray, desc } from 'drizzle-orm';
import type { DB } from '../index';
import { alerts, documents, drivers, vehicles } from '../schema';
import { money } from './_util';

export async function openAlerts(db: DB) {
  const rows = await db
    .select()
    .from(alerts)
    .where(inArray(alerts.status, ['open', 'acknowledged']))
    .orderBy(
      sql`case ${alerts.severity} when 'critical' then 0 when 'warning' then 1 else 2 end`,
      desc(alerts.raised_at),
    );
  return rows;
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

export async function documentList(db: DB): Promise<DocRow[]> {
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
    .orderBy(documents.expiry_date);

  const now = Date.now();
  return rows.map((r) => ({
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
}

export { money };
