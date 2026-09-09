import { requirePermission } from '@/lib/session';
import { db, sql } from '@bv/db';
import { toCsv } from '@/lib/csv';

export const dynamic = 'force-dynamic';

const QUERIES: Record<string, string> = {
  trips: `
    select t.reference_code, v.registration as vehicle, d.full_name as driver, r.name as route,
      t.status, t.started_at, t.ended_at,
      (t.end_odometer_km::numeric - t.start_odometer_km::numeric) as odometer_km,
      (select count(*) from bigventures.drops dr where dr.trip_id = t.id) as drops,
      (select coalesce(sum(fe.total_cost::numeric),0) from bigventures.fuel_entries fe where fe.trip_id = t.id) as fuel_cost
    from bigventures.trips t
    left join bigventures.vehicles v on v.id = t.vehicle_id
    left join bigventures.drivers d on d.id = t.driver_id
    left join bigventures.routes r on r.id = t.route_id
    order by t.started_at desc`,
  fuel: `
    select fe.filled_at, v.registration as vehicle, d.full_name as driver, fe.litres, fe.unit_price,
      fe.total_cost, fe.odometer_km, fe.station
    from bigventures.fuel_entries fe
    left join bigventures.vehicles v on v.id = fe.vehicle_id
    left join bigventures.drivers d on d.id = fe.driver_id
    order by fe.filled_at desc`,
  costs: `
    select ce.incurred_at, ce.category, ce.amount, ce.description, ce.vendor, ce.status,
      v.registration as vehicle, d.full_name as driver
    from bigventures.cost_entries ce
    left join bigventures.vehicles v on v.id = ce.vehicle_id
    left join bigventures.drivers d on d.id = ce.driver_id
    order by ce.incurred_at desc`,
  advances: `
    select a.issued_at, d.full_name as driver, a.direction, a.amount, a.method, a.reference, a.description
    from bigventures.advances a
    join bigventures.drivers d on d.id = a.driver_id
    order by a.issued_at desc`,
  invoices: `
    select i.invoice_number, c.name as client, i.status, i.issue_date, i.due_date,
      i.subtotal, i.tax, i.total, i.amount_paid, (i.total::numeric - i.amount_paid::numeric) as outstanding
    from bigventures.invoices i
    left join bigventures.clients c on c.id = i.client_id
    order by i.issue_date desc`,
  payroll: `
    select pr.period_key, d.full_name as driver, pr.trip_count, pr.base_salary, pr.incentive_amount,
      pr.quality_score, pr.advance_deduction, pr.loss_deduction, pr.net_pay, pr.status
    from bigventures.payroll_runs pr
    join bigventures.drivers d on d.id = pr.driver_id
    order by pr.period_key desc, d.full_name`,
};

export async function GET(_req: Request, { params }: { params: Promise<{ type: string }> }) {
  await requirePermission('report:export');
  const { type } = await params;
  const query = QUERIES[type];
  if (!query) return new Response('unknown export type', { status: 404 });

  const result = await db.execute(sql.raw(query));
  const rows = (result.rows ?? result) as Record<string, unknown>[];
  const csv = toCsv(rows);

  return new Response(csv, {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="bigventures-${type}-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
