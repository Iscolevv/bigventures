/**
 * The exception / alerts engine. Scans the operational tables for conditions
 * worth a manager's attention and upserts `alerts` rows keyed by `dedupe_key`
 * so one condition never produces duplicate open alerts. Auto-resolves alerts
 * whose condition has cleared.
 *
 * Runs from the dashboard "rescan" button and the nightly cron
 * (/api/cron/alerts).
 */
import { sql } from '@bv/db';
import type { DB } from '@bv/db';
import { ALERT_THRESHOLDS, ALERT_SEVERITY_DEFAULT } from '@bv/core/reference';
import type { AlertType } from '@bv/core/enums';

interface Candidate {
  type: AlertType;
  dedupeKey: string;
  entityType: string;
  entityId: string;
  title: string;
  detail: Record<string, unknown>;
}

export async function runAlertScan(db: DB): Promise<number> {
  const c: Candidate[] = [];

  // --- document expiry -------------------------------------------------
  const docs = await db.execute<{
    id: string;
    title: string;
    expiry_date: string;
    days: number;
  }>(sql`
    select id, title, expiry_date::text as expiry_date,
      (expiry_date - current_date) as days
    from bigventures.documents
    where expiry_date is not null and expiry_date <= current_date + 45
  `);
  for (const d of docs.rows as { id: string; title: string; expiry_date: string; days: number }[]) {
    c.push({
      type: 'document_expiry',
      dedupeKey: `document_expiry:${d.id}`,
      entityType: 'document',
      entityId: d.id,
      title: d.days < 0 ? `${d.title} expired` : `${d.title} expires in ${d.days}d`,
      detail: { expiryDate: d.expiry_date, days: d.days },
    });
  }

  // --- overdue advances ---------------------------------------------
  const adv = await db.execute(sql`
    select d.id as driver_id, d.full_name, d.advance_balance,
      (current_date - max(a.issued_at)) as age_days
    from bigventures.drivers d
    join bigventures.advances a on a.driver_id = d.id and a.direction = 'disbursed'
    where d.advance_balance::numeric > 0
    group by d.id, d.full_name, d.advance_balance
    having (current_date - max(a.issued_at)) > ${sql.raw(String(ALERT_THRESHOLDS.advanceOverdueDays))}
  `);
  for (const r of adv.rows as { driver_id: string; full_name: string; advance_balance: string; age_days: number }[]) {
    c.push({
      type: 'overdue_advance',
      dedupeKey: `overdue_advance:${r.driver_id}`,
      entityType: 'driver',
      entityId: r.driver_id,
      title: `${r.full_name} advance ${Math.round(Number(r.advance_balance)).toLocaleString()} outstanding ${r.age_days}d`,
      detail: { balance: Number(r.advance_balance), ageDays: r.age_days },
    });
  }

  // --- overdue invoices -------------------------------------------
  const inv = await db.execute(sql`
    select id, invoice_number, (total::numeric - amount_paid::numeric) as outstanding,
      (current_date - due_date) as days_over
    from bigventures.invoices
    where status not in ('paid','void') and due_date < current_date - ${sql.raw(String(ALERT_THRESHOLDS.invoiceOverdueGraceDays))}
  `);
  for (const r of inv.rows as { id: string; invoice_number: string; outstanding: string; days_over: number }[]) {
    c.push({
      type: 'overdue_invoice',
      dedupeKey: `overdue_invoice:${r.id}`,
      entityType: 'invoice',
      entityId: r.id,
      title: `${r.invoice_number} overdue ${r.days_over}d — ${Math.round(Number(r.outstanding)).toLocaleString()}`,
      detail: { outstanding: Number(r.outstanding), daysOver: r.days_over },
    });
  }

  // --- maintenance due -------------------------------------------
  const maint = await db.execute(sql`
    select id, registration,
      (next_service_due_km::numeric - odometer_km::numeric) as km_to_service
    from bigventures.vehicles
    where next_service_due_km is not null
      and next_service_due_km::numeric - odometer_km::numeric <= ${sql.raw(String(ALERT_THRESHOLDS.serviceDueKm))}
  `);
  for (const r of maint.rows as { id: string; registration: string; km_to_service: string }[]) {
    c.push({
      type: 'maintenance_due',
      dedupeKey: `maintenance_due:${r.id}`,
      entityType: 'vehicle',
      entityId: r.id,
      title: `${r.registration} service due in ${Math.max(0, Math.round(Number(r.km_to_service)))} km`,
      detail: { kmToService: Number(r.km_to_service) },
    });
  }

  // --- idle vehicles --------------------------------------------
  const idle = await db.execute(sql`
    select v.id, v.registration,
      (current_date - max(t.started_at)::date) as idle_days
    from bigventures.vehicles v
    left join bigventures.trips t on t.vehicle_id = v.id
    where v.status = 'active'
    group by v.id, v.registration
    having max(t.started_at) is null or (current_date - max(t.started_at)::date) > ${sql.raw(String(ALERT_THRESHOLDS.vehicleIdleDays))}
  `);
  for (const r of idle.rows as { id: string; registration: string; idle_days: number | null }[]) {
    c.push({
      type: 'idle_vehicle',
      dedupeKey: `idle_vehicle:${r.id}`,
      entityType: 'vehicle',
      entityId: r.id,
      title: `${r.registration} idle ${r.idle_days ?? 'ever'} day(s)`,
      detail: { idleDays: r.idle_days },
    });
  }

  // --- failed checks -------------------------------------------
  const fchk = await db.execute(sql`
    select vc.id, vc.trip_id, t.reference_code, v.registration
    from bigventures.vehicle_checks vc
    join bigventures.trips t on t.id = vc.trip_id
    join bigventures.vehicles v on v.id = vc.vehicle_id
    where vc.overall_result = 'fail' and vc.overridden_by is null
      and vc.performed_at > now() - interval '30 days'
  `);
  for (const r of fchk.rows as { id: string; trip_id: string; reference_code: string; registration: string }[]) {
    c.push({
      type: 'failed_check',
      dedupeKey: `failed_check:${r.id}`,
      entityType: 'trip',
      entityId: r.trip_id,
      title: `${r.registration} failed pre-trip check on ${r.reference_code}`,
      detail: { checkId: r.id },
    });
  }

  // --- missing POD on delivered drops -------------------------
  const pod = await db.execute(sql`
    select d.id, d.destination_address, t.reference_code, t.id as trip_id
    from bigventures.drops d
    join bigventures.trips t on t.id = d.trip_id
    where d.status = 'delivered'
      and d.completed_at < now() - interval '${sql.raw(String(ALERT_THRESHOLDS.missingPodHours))} hours'
      and d.completed_at > now() - interval '4 days'
      and not exists (select 1 from bigventures.pod_photos pp where pp.drop_id = d.id)
  `);
  for (const r of pod.rows as { id: string; destination_address: string; reference_code: string; trip_id: string }[]) {
    c.push({
      type: 'missing_pod',
      dedupeKey: `missing_pod:${r.id}`,
      entityType: 'trip',
      entityId: r.trip_id,
      title: `${r.reference_code}: no POD for ${r.destination_address}`,
      detail: { dropId: r.id },
    });
  }

  // --- delivery issues -----------------------------------------
  const iss = await db.execute(sql`
    select d.id, d.issue_category, d.destination_address, t.reference_code, t.id as trip_id
    from bigventures.drops d
    join bigventures.trips t on t.id = d.trip_id
    where d.issue_category is not null and t.started_at > now() - interval '14 days'
  `);
  for (const r of iss.rows as { id: string; issue_category: string; destination_address: string; reference_code: string; trip_id: string }[]) {
    c.push({
      type: 'delivery_issue',
      dedupeKey: `delivery_issue:${r.id}`,
      entityType: 'trip',
      entityId: r.trip_id,
      title: `${r.reference_code}: ${r.issue_category} at ${r.destination_address}`,
      detail: { dropId: r.id, category: r.issue_category },
    });
  }

  // --- route deviations --------------------------------------
  const dev = await db.execute(sql`
    select td.id, td.type, t.reference_code, t.id as trip_id
    from bigventures.trip_deviations td
    join bigventures.trips t on t.id = td.trip_id
    where td.reviewed = false and td.detected_at > now() - interval '30 days'
  `);
  for (const r of dev.rows as { id: string; type: string; reference_code: string; trip_id: string }[]) {
    c.push({
      type: 'route_deviation',
      dedupeKey: `route_deviation:${r.id}`,
      entityType: 'trip',
      entityId: r.trip_id,
      title: `${r.reference_code}: ${String(r.type).replace(/_/g, ' ')}`,
      detail: { deviationId: r.id },
    });
  }

  // --- upsert + auto-resolve ---------------------------------
  const keys = c.map((x) => x.dedupeKey);
  let raised = 0;
  for (const cand of c) {
    const existing = await db.execute(
      sql`select id from bigventures.alerts where dedupe_key = ${cand.dedupeKey} and status in ('open','acknowledged') limit 1`,
    );
    if ((existing.rows as unknown[]).length === 0) {
      await db.execute(sql`
        insert into bigventures.alerts (id, type, severity, status, entity_type, entity_id, title, detail, dedupe_key, raised_at)
        values (gen_random_uuid()::text, ${cand.type}, ${ALERT_SEVERITY_DEFAULT[cand.type]}, 'open', ${cand.entityType}, ${cand.entityId}, ${cand.title}, ${JSON.stringify(cand.detail)}::jsonb, ${cand.dedupeKey}, now())
      `);
      raised++;
    }
  }
  // auto-resolve alerts whose condition no longer fires
  if (keys.length) {
    await db.execute(sql`
      update bigventures.alerts set status = 'resolved', resolved_at = now(), resolution_notes = 'auto: condition cleared'
      where status in ('open','acknowledged') and dedupe_key is not null
        and dedupe_key not in (${sql.join(keys.map((k) => sql`${k}`), sql`, `)})
    `);
  }
  return raised;
}
