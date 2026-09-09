import { config } from 'dotenv';
config({ path: ['.env', '../../.env'] });
import { randomUUID } from 'node:crypto';
import { eq, sql } from 'drizzle-orm';
import { getDb } from './index';
import * as s from './schema';
import { DEFAULT_INCENTIVE_CONFIG, evaluateIncentive, runPayroll, qualityScore } from '@bv/core/calc';
import { routeKey } from '@bv/core/geo';
import { periodKey } from '@bv/core/reference';

/**
 * Demo dataset for Big Ventures, shaped after the Jan–Aug 2026 expense book:
 * the real 8-unit fleet, a driver roster, clients, ~8 weeks of trips with
 * drops / fuel / costs / advances, plus quality snapshots and a draft payroll
 * run. Batched inserts so a full seed is seconds, not minutes.
 *
 *   pnpm db:seed          # wipe + regenerate operational data
 *   pnpm db:seed -- keep  # base data only
 */
const KEEP = process.argv.includes('keep');
const db = getDb();

// ---- deterministic RNG ------------------------------------------------
let _s = 20260909;
const rnd = () => ((_s = (_s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
const pick = <T>(xs: readonly T[]): T => xs[Math.floor(rnd() * xs.length)]!;
const int = (lo: number, hi: number) => lo + Math.floor(rnd() * (hi - lo + 1));
const m2 = (n: number) => n.toFixed(2);
const ymd = (d: Date) => d.toISOString().slice(0, 10);
const addDays = (d: Date, n: number) => new Date(d.getTime() + n * 86_400_000);
const uid = () => randomUUID();

const NBI = { lat: -1.286, lng: 36.817 };
const jitter = (p: { lat: number; lng: number }, km = 8) => ({
  lat: p.lat + (rnd() - 0.5) * (km / 111),
  lng: p.lng + (rnd() - 0.5) * (km / 111),
});

async function bulk<T>(table: unknown, rows: T[], chunk = 150) {
  for (let i = 0; i < rows.length; i += chunk) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (db as any).insert(table).values(rows.slice(i, i + chunk));
  }
}

async function wipe(tables: string[]) {
  for (const t of tables) await db.execute(sql.raw(`delete from "bigventures"."${t}"`));
}

async function main() {
  console.log(`seeding${KEEP ? ' (keep operational)' : ' (fresh operational)'}…`);

  // ---------- settings + incentive rule ----------
  await db.insert(s.settings).values({ key: 'default', company_name: 'Big Ventures', invoice_tax_pct: '16' }).onConflictDoNothing();
  let rule = (await db.select().from(s.incentiveRules).where(eq(s.incentiveRules.active, true)).limit(1))[0];
  if (!rule) {
    const id = uid();
    await db.insert(s.incentiveRules).values({ id, name: 'Standard 2026', active: true, effective_from: '2026-01-01', config: DEFAULT_INCENTIVE_CONFIG });
    rule = (await db.select().from(s.incentiveRules).where(eq(s.incentiveRules.id, id)).limit(1))[0]!;
  }
  await db.update(s.settings).set({ active_incentive_rule_id: rule.id }).where(eq(s.settings.key, 'default'));

  // ---------- vehicles ----------
  const vSeed = [
    ['KCD 448E', 'van', '24000', 'Isuzu', 'NLR', 2019],
    ['KCM 850A', 'van', '24000', 'Isuzu', 'NLR', 2020],
    ['KCY 046L', 'van', '24000', 'Mitsubishi', 'Canter', 2018],
    ['KDJ 483Z', 'truck', '68000', 'FAW', 'CA', 2021],
    ['KDE 322N', 'pickup', '17000', 'Toyota', 'Hilux', 2017],
    ['KDM 822D', 'pickup', '17000', 'Toyota', 'Hilux', 2018],
    ['KDT 121S', 'pickup', '17000', 'Nissan', 'NP300', 2016],
    ['KDP 150M', 'pickup', '17000', 'Toyota', 'Hilux', 2019],
  ] as const;
  for (const [reg, type, fin, make, model, year] of vSeed) {
    await db.insert(s.vehicles).values({
      registration: reg,
      vehicle_type: type,
      monthly_finance_cost: fin,
      make,
      model,
      year,
      odometer_km: m2(int(80_000, 260_000)),
    }).onConflictDoNothing();
  }
  const vehicles = await db.select().from(s.vehicles);
  const byReg = (r: string) => vehicles.find((v) => v.registration === r)!;
  await db.update(s.vehicles)
    .set({ next_service_due_km: sql`${s.vehicles.odometer_km} + 800`, last_service_odometer_km: sql`${s.vehicles.odometer_km} - 9200` })
    .where(eq(s.vehicles.registration, 'KCY 046L'));

  // ---------- drivers + users ----------
  const today = new Date('2026-09-09T18:00:00Z');
  const dSeed = [
    ['Nahashon Gitau', 30000, 'DL0451221', 90],
    ['Simon Wanyoike', 25000, 'DL0338910', 20],
    ['Dismas Otieno', 20000, 'DL0912455', 400],
    ['Tony Kimani', 30000, 'DL0221782', 210],
    ['Stephen Kamau', 23000, 'DL0771290', -10],
    ['Alex Kibui', 20000, 'DL0655012', 150],
    ['Willi Ochieng', 23000, 'DL0489331', 300],
    ['Raha Kabui', 25000, 'DL0102934', 260],
  ] as const;
  let phoneN = 100001;
  for (const [name, base, lic, licDays] of dSeed) {
    const email = `${name.toLowerCase().replace(/\s+/g, '.')}@bigventures.demo`;
    const phone = `+2547001${String(phoneN++).padStart(5, '0')}`;
    let u = (await db.select().from(s.user).where(eq(s.user.email, email)).limit(1))[0];
    if (!u) {
      const id = uid();
      await db.insert(s.user).values({ id, name, email, role: 'driver', status: 'active', phone });
      u = (await db.select().from(s.user).where(eq(s.user.id, id)).limit(1))[0]!;
    }
    await db.insert(s.drivers).values({
      user_id: u.id,
      full_name: name,
      phone,
      license_number: lic,
      license_expiry: ymd(addDays(today, licDays)),
      base_salary: m2(base),
      status: 'active',
      date_joined: '2026-01-06',
    }).onConflictDoNothing();
  }
  await db.insert(s.user).values([
    { id: uid(), name: 'Kevin Mwangi', email: 'kevin@bigventures.demo', role: 'operations', status: 'active' },
    { id: uid(), name: 'Raha (Director)', email: 'raha@bigventures.demo', role: 'management', status: 'active' },
  ]).onConflictDoNothing();
  const drivers = await db.select().from(s.drivers);
  const driverByName = (n: string) => drivers.find((d) => d.full_name === n)!;

  // ---------- assignments ----------
  const plan: [string, string][] = [
    ['Nahashon Gitau', 'KCD 448E'], ['Simon Wanyoike', 'KCM 850A'], ['Dismas Otieno', 'KCY 046L'],
    ['Tony Kimani', 'KDJ 483Z'], ['Stephen Kamau', 'KDE 322N'], ['Alex Kibui', 'KDM 822D'],
    ['Willi Ochieng', 'KDT 121S'], ['Raha Kabui', 'KDP 150M'],
  ];
  for (const [dn, reg] of plan) {
    await db.insert(s.vehicleAssignments)
      .values({ vehicle_id: byReg(reg).id, driver_id: driverByName(dn).id, start_date: '2026-01-06' })
      .onConflictDoNothing();
  }

  // ---------- clients + rates ----------
  const cSeed = [
    ['Ajab Flour Mills', 'Procurement Desk', 30],
    ['Papa Distributors', 'John Papa', 14],
    ['MEDS Kitui', 'Warehouse', 45],
    ['CST Wholesalers', 'Anne', 21],
  ] as const;
  for (const [name, contact, terms] of cSeed) {
    await db.insert(s.clients).values({ name, contact_name: contact, payment_terms_days: terms }).onConflictDoNothing();
  }
  const clients = await db.select().from(s.clients);
  const clientByName = (n: string) => clients.find((c) => c.name === n)!;
  for (const c of clients) {
    const existing = await db.select().from(s.clientRates).where(eq(s.clientRates.client_id, c.id)).limit(1);
    if (!existing[0]) {
      await db.insert(s.clientRates).values({
        client_id: c.id,
        rate_type: c.name === 'MEDS Kitui' ? 'per_trip' : 'per_drop',
        amount: m2(c.name === 'MEDS Kitui' ? 165000 : int(2200, 4200)),
        effective_from: '2026-01-01',
      });
    }
  }

  // ---------- routes ----------
  const rSeed = [
    ['CST Yard → Nairobi CBD drops', 'CST Yard, Industrial Area', -1.309, 36.851],
    ['JG Road Depot → Mombasa', 'JG Road Depot', -1.283, 36.826],
    ['Ojijo Road → local runs', 'Ojijo Road', -1.263, 36.813],
    ['CST Yard → Kitui (MEDS)', 'CST Yard, Industrial Area', -1.309, 36.851],
  ] as const;
  for (const [name, label, lat, lng] of rSeed) {
    await db.insert(s.routes).values({ name, origin_label: label, origin_lat: lat, origin_lng: lng }).onConflictDoNothing();
  }
  const routes = await db.select().from(s.routes);
  const routeByName = (n: string) => routes.find((r) => r.name === n)!;

  // ---------- documents ----------
  await wipe(['documents']);
  const docRows: (typeof s.documents.$inferInsert)[] = [
    { owner_type: 'company', owner_id: null, doc_type: 'certificate_of_incorporation', title: 'Certificate of Incorporation', storage_key: 'seed/coi.pdf', status: 'valid', mime_type: 'application/pdf' },
    { owner_type: 'company', owner_id: null, doc_type: 'kra_pin', title: 'KRA PIN Certificate', storage_key: 'seed/kra.pdf', status: 'valid', mime_type: 'application/pdf' },
    { owner_type: 'company', owner_id: null, doc_type: 'business_permit', title: 'County Business Permit 2026', storage_key: 'seed/permit.pdf', status: 'expiring_soon', issue_date: '2026-01-05', expiry_date: ymd(addDays(today, 25)), mime_type: 'application/pdf' },
  ];
  for (const v of vehicles) {
    const insExp = addDays(today, int(-15, 120));
    docRows.push(
      { owner_type: 'vehicle', owner_id: v.id, doc_type: 'insurance_certificate', title: `${v.registration} — Insurance`, storage_key: `seed/ins-${v.registration}.pdf`, issue_date: ymd(addDays(insExp, -365)), expiry_date: ymd(insExp), status: insExp < today ? 'expired' : insExp < addDays(today, 30) ? 'expiring_soon' : 'valid', mime_type: 'application/pdf' },
      { owner_type: 'vehicle', owner_id: v.id, doc_type: 'ntsa_inspection', title: `${v.registration} — NTSA Inspection`, storage_key: `seed/ntsa-${v.registration}.pdf`, expiry_date: ymd(addDays(today, int(20, 300))), status: 'valid', mime_type: 'application/pdf' },
      { owner_type: 'vehicle', owner_id: v.id, doc_type: 'logbook', title: `${v.registration} — Logbook`, storage_key: `seed/log-${v.registration}.pdf`, status: 'valid', mime_type: 'application/pdf' },
    );
  }
  for (const d of drivers) {
    docRows.push(
      { owner_type: 'driver', owner_id: d.id, doc_type: 'drivers_license', title: `${d.full_name} — Licence`, storage_key: `seed/dl-${d.id}.jpg`, expiry_date: d.license_expiry, status: d.license_expiry && d.license_expiry < ymd(today) ? 'expired' : 'valid', mime_type: 'image/jpeg' },
      { owner_type: 'driver', owner_id: d.id, doc_type: 'good_conduct', title: `${d.full_name} — Good Conduct`, storage_key: `seed/gc-${d.id}.pdf`, expiry_date: ymd(addDays(today, int(-30, 400))), status: 'valid', mime_type: 'application/pdf' },
      { owner_type: 'driver', owner_id: d.id, doc_type: 'nssf', title: `${d.full_name} — NSSF`, storage_key: `seed/nssf-${d.id}.pdf`, status: 'valid', mime_type: 'application/pdf' },
      { owner_type: 'driver', owner_id: d.id, doc_type: 'shif', title: `${d.full_name} — SHIF`, storage_key: `seed/shif-${d.id}.pdf`, status: 'pending_review', mime_type: 'application/pdf' },
    );
  }
  await bulk(s.documents, docRows);

  if (KEEP) { console.log('done (kept operational)'); return; }

  // ---------- operational: wipe ----------
  await wipe([
    'trail_segments', 'pod_photos', 'drops', 'trip_deviations', 'vehicle_check_items', 'vehicle_checks',
    'invoice_lines', 'payments', 'invoices', 'fuel_entries', 'cost_entries', 'advances',
    'payroll_runs', 'quality_snapshots', 'alerts', 'audit_log', 'sync_batches', 'trips',
  ]);

  // ---------- operational: build in memory, bulk insert ----------
  const tripRows: (typeof s.trips.$inferInsert)[] = [];
  const checkRows: (typeof s.vehicleChecks.$inferInsert)[] = [];
  const checkItemRows: (typeof s.vehicleCheckItems.$inferInsert)[] = [];
  const dropRows: (typeof s.drops.$inferInsert)[] = [];
  const podRows: (typeof s.podPhotos.$inferInsert)[] = [];
  const fuelRows: (typeof s.fuelEntries.$inferInsert)[] = [];
  const costRows: (typeof s.costEntries.$inferInsert)[] = [];
  const devRows: (typeof s.tripDeviations.$inferInsert)[] = [];
  const invoiceable: Record<string, { tripId: string; drops: number }[]> = {};

  const start = new Date('2026-07-06T05:30:00Z');
  const cbd = ['Nyamakima CBD', 'Kirinyaga Road', 'Gikomba Market', 'River Road', 'Eastleigh 1st Ave'];
  const cbdClient = ['CST Wholesalers', 'CST Wholesalers', 'Papa Distributors', 'Papa Distributors', 'Ajab Flour Mills'];
  const local = ['Ojijo Road shops', 'Parklands 3rd Ave', 'Highridge'];
  const localClient = ['Papa Distributors', 'CST Wholesalers', 'Ajab Flour Mills'];
  let tripSeq = 0;

  for (let w = 0; w < 10; w++) {
    for (let day = 0; day < 6; day++) {
      const date = addDays(start, w * 7 + day);
      if (date > today) continue;
      for (const [dn, reg] of plan) {
        const driver = driverByName(dn);
        const vehicle = byReg(reg);
        if (reg === 'KDE 322N' && w === 3 && day < 3) continue;
        if (rnd() < 0.08) continue;

        const isTruck = vehicle.vehicle_type === 'truck';
        const isVan = vehicle.vehicle_type === 'van';
        const route = isTruck
          ? rnd() < 0.5 ? routeByName('JG Road Depot → Mombasa') : routeByName('CST Yard → Kitui (MEDS)')
          : isVan ? routeByName('CST Yard → Nairobi CBD drops') : routeByName('Ojijo Road → local runs');

        const nDrops = isTruck ? 1 : isVan ? int(3, 5) : int(2, 3);
        const dropAddrs: { addr: string; client: string }[] = isTruck
          ? [{ addr: route.name.includes('Mombasa') ? 'Mombasa — Changamwe depot' : 'Kitui — MEDS warehouse', client: 'MEDS Kitui' }]
          : Array.from({ length: nDrops }, (_, i) =>
              isVan ? { addr: cbd[i]!, client: cbdClient[i]! } : { addr: local[i]!, client: localClient[i]! });

        const startedAt = new Date(date.getTime() + int(0, 90) * 60_000);
        const distKm = isTruck ? int(430, 520) : isVan ? int(28, 46) : int(14, 26);
        const durMin = isTruck ? int(540, 720) : isVan ? int(180, 300) : int(90, 160);
        const endedAt = new Date(startedAt.getTime() + durMin * 60_000);
        const startOdo = Number(vehicle.odometer_km) + w * 7 * (isTruck ? 60 : isVan ? 12 : 6);
        const endOdo = startOdo + distKm;
        const loading = jitter(NBI, 3);
        const destPts = dropAddrs.map(() => jitter(NBI, isTruck ? 4 : 12));

        tripSeq++;
        const tripId = uid();
        const anyIssue = rnd() < 0.12;
        tripRows.push({
          id: tripId,
          reference_code: `TRP-2026-${String(tripSeq).padStart(6, '0')}`,
          vehicle_id: vehicle.id,
          driver_id: driver.id,
          route_id: route.id,
          route_key: routeKey(loading, destPts),
          status: anyIssue ? 'flagged' : 'completed',
          loading_point_address: route.origin_label,
          loading_lat: loading.lat,
          loading_lng: loading.lng,
          planned_distance_m: distKm * 1000,
          planned_duration_s: durMin * 60,
          started_at: startedAt,
          ended_at: endedAt,
          start_odometer_km: m2(startOdo),
          end_odometer_km: m2(endOdo),
          actual_distance_m: Math.round(distKm * 1000 * (1 + (rnd() - 0.4) * 0.1)),
          cargo_description: isTruck ? 'Bulk consignment' : 'Assorted FMCG',
          client_id: clientByName(dropAddrs[0]!.client).id,
          source: 'mobile',
          device_id: `seed-${driver.id.slice(0, 6)}`,
        });

        const checkId = uid();
        checkRows.push({
          id: checkId,
          trip_id: tripId,
          vehicle_id: vehicle.id,
          driver_id: driver.id,
          performed_at: new Date(startedAt.getTime() - 15 * 60_000),
          overall_result: rnd() < 0.05 ? 'flagged' : 'pass',
          odometer_km: m2(startOdo),
        });
        for (const k of ['tires', 'brakes', 'lights', 'fuel_level', 'documents', 'cargo_secure']) {
          checkItemRows.push({
            check_id: checkId,
            item_key: k,
            result: 'pass',
            value: k === 'fuel_level' ? pick(['1/2', '3/4', 'Full']) : undefined,
          });
        }

        let issued = 0;
        dropAddrs.forEach((ds, i) => {
          const dp = destPts[i]!;
          const seq = i + 1;
          const arrived = new Date(startedAt.getTime() + (durMin / dropAddrs.length) * seq * 60_000);
          const failed = anyIssue && seq === dropAddrs.length;
          const dropId = uid();
          dropRows.push({
            id: dropId,
            trip_id: tripId,
            sequence: seq,
            destination_address: ds.addr,
            dest_lat: dp.lat,
            dest_lng: dp.lng,
            status: failed ? pick(['failed', 'partial', 'returned'] as const) : 'delivered',
            signee_name: failed ? undefined : pick(['J. Mwangi', 'A. Otieno', 'Storekeeper', 'P. Kamau']),
            issue_category: failed ? pick(['damage', 'rejected', 'shortage'] as const) : undefined,
            issue_notes: failed ? 'Customer flagged short count on delivery' : undefined,
            arrived_at: arrived,
            completed_at: new Date(arrived.getTime() + int(8, 25) * 60_000),
            geofence_entered_at: rnd() < 0.9 ? arrived : undefined,
            geofence_skipped: rnd() < 0.1,
          });
          if (!failed) {
            issued++;
            if (rnd() < 0.85) {
              podRows.push({
                drop_id: dropId,
                storage_key: `seed/pod/${dropId}.jpg`,
                captured_lat: dp.lat,
                captured_lng: dp.lng,
                captured_at: new Date(arrived.getTime() + 5 * 60_000),
                mime_type: 'image/jpeg',
              });
            }
          }
        });
        if (issued > 0) (invoiceable[dropAddrs[0]!.client] ??= []).push({ tripId, drops: issued });

        if (isTruck || rnd() < 0.6) {
          const litres = isTruck ? int(90, 130) : isVan ? int(18, 34) : int(10, 20);
          const anomaly = rnd() < 0.05;
          const price = 214 + int(-4, 6);
          const L = anomaly ? litres * 1.5 : litres;
          fuelRows.push({
            vehicle_id: vehicle.id,
            driver_id: driver.id,
            trip_id: tripId,
            litres: m2(L),
            unit_price: m2(price),
            total_cost: m2(L * price),
            odometer_km: m2(endOdo),
            station: pick(['Shell Industrial Area', 'Total Mombasa Rd', 'Rubis Ojijo', 'OilLibya Kitui']),
            filled_at: endedAt,
            source: 'mobile',
          });
        }
        if (rnd() < 0.5) {
          costRows.push({
            vehicle_id: vehicle.id,
            driver_id: driver.id,
            trip_id: tripId,
            category: pick(['parking', 'parking', 'police', 'toll', 'cleaning'] as const),
            amount: m2(int(200, 1500)),
            incurred_at: ymd(date),
            description: pick(['CBD parking', 'Council parking', 'Roadside check', 'Weighbridge toll', 'Truck wash']),
            status: rnd() < 0.7 ? 'approved' : 'pending',
            source: 'mobile',
          });
        }
        if (rnd() < 0.06) {
          costRows.push({
            vehicle_id: vehicle.id,
            driver_id: driver.id,
            trip_id: tripId,
            category: pick(['repair', 'tires', 'welding', 'spares'] as const),
            amount: m2(int(4000, 42000)),
            incurred_at: ymd(date),
            description: pick(['Front axle', 'Clutch repair', 'Rear door welding', 'New tyre', 'Radiator flush']),
            status: 'approved',
            vendor: pick(['Kiboro Garage', 'Grogan', 'Industrial Area fitters']),
            source: 'dashboard',
          });
        }
        if (anyIssue && rnd() < 0.5) {
          devRows.push({
            trip_id: tripId,
            type: pick(['off_route', 'unscheduled_stop', 'excessive_idle'] as const),
            detected_at: new Date(startedAt.getTime() + int(30, 200) * 60_000),
            lat: jitter(NBI, 15).lat,
            lng: jitter(NBI, 15).lng,
            detail: { note: 'auto-flagged from GPS trail' },
          });
        }
      }
    }
  }

  await bulk(s.trips, tripRows);
  await bulk(s.vehicleChecks, checkRows);
  await bulk(s.vehicleCheckItems, checkItemRows);
  await bulk(s.drops, dropRows);
  await bulk(s.podPhotos, podRows);
  await bulk(s.fuelEntries, fuelRows);
  await bulk(s.costEntries, costRows);
  await bulk(s.tripDeviations, devRows);
  console.log(`  ${tripRows.length} trips, ${dropRows.length} drops, ${fuelRows.length} fuel, ${costRows.length} costs`);

  // ---------- advances ----------
  const advRows: (typeof s.advances.$inferInsert)[] = [];
  const kamau = driverByName('Stephen Kamau');
  for (const d of drivers) {
    let bal = 0;
    for (let i = 0; i < int(2, 5); i++) {
      const amt = int(2000, 12000);
      bal += amt;
      advRows.push({
        driver_id: d.id,
        amount: m2(amt),
        direction: 'disbursed',
        issued_at: ymd(addDays(start, int(0, 45))),
        method: pick(['mpesa', 'cash'] as const),
        description: pick(['Police Mwingi', 'Fuel + allowance', 'Family emergency', 'Advance on salary']),
      });
    }
    if (rnd() < 0.5) {
      const rep = Math.min(bal, int(2000, 6000));
      advRows.push({ driver_id: d.id, amount: m2(rep), direction: 'repaid', issued_at: ymd(addDays(start, int(30, 55))), method: 'mpesa', description: 'Salary deduction' });
      bal -= rep;
    }
    await db.update(s.drivers).set({ advance_balance: m2(bal), loss_balance: d.id === kamau.id ? m2(15594.92) : '0' }).where(eq(s.drivers.id, d.id));
  }
  await bulk(s.advances, advRows);

  // ---------- quality + draft payroll (August) ----------
  const augStart = new Date('2026-08-01T00:00:00Z');
  const augEnd = new Date('2026-08-31T00:00:00Z');
  const pkey = periodKey(augStart);
  const freshDrivers = await db.select().from(s.drivers);
  const qRows: (typeof s.qualitySnapshots.$inferInsert)[] = [];
  const payRows: (typeof s.payrollRuns.$inferInsert)[] = [];
  for (const d of freshDrivers) {
    const cnt = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(s.trips)
      .where(sql`${s.trips.driver_id} = ${d.id} and ${s.trips.started_at} >= ${augStart} and ${s.trips.started_at} < ${addDays(augEnd, 1)}`);
    const tripCount = cnt[0]?.n ?? 0;
    const q = qualityScore({
      onTimeDrops: int(80, 100), totalDrops: 100, cleanDrops: int(85, 100),
      checksCompleted: int(18, 22), checksRequired: 22,
      fullyDocumentedTrips: int(16, 22), deliveredTrips: 22,
      atFaultIncidents: d.id === kamau.id ? 1 : 0,
    });
    qRows.push({
      driver_id: d.id, period_key: pkey,
      on_time_pct: m2(q.components.onTime), damage_free_pct: m2(q.components.damageFree),
      check_compliance_pct: m2(q.components.checkCompliance), pod_compliance_pct: m2(q.components.podCompliance),
      at_fault_incidents: d.id === kamau.id ? 1 : 0, composite_score: m2(q.composite),
    });
    const inc = evaluateIncentive(rule.config, { tripCount, qualityScore: q.composite });
    const pay = runPayroll({
      driverId: d.id, periodStart: augStart, periodEnd: augEnd,
      baseSalary: Number(d.base_salary), incentive: inc.netIncentive,
      openingAdvanceBalance: Number(d.advance_balance), advancesThisPeriod: 0,
      openingLossBalance: d.id === kamau.id ? 15594.92 : 0, lossInstalment: d.id === kamau.id ? 5000 : 0,
    });
    payRows.push({
      driver_id: d.id, period_key: pkey, period_start: ymd(augStart), period_end: ymd(augEnd),
      trip_count: tripCount, base_salary: m2(Number(d.base_salary)),
      incentive_amount: m2(inc.netIncentive), incentive_rule_id: rule.id, quality_score: m2(q.composite),
      advance_deduction: m2(pay.advanceDeduction), loss_deduction: m2(pay.lossDeduction), net_pay: m2(pay.netPay),
      breakdown: { incentive: inc, payroll: pay }, status: 'draft',
    });
  }
  await bulk(s.qualitySnapshots, qRows);
  await bulk(s.payrollRuns, payRows);

  // ---------- invoices ----------
  let invNo = 1001;
  const invRows: (typeof s.invoices.$inferInsert)[] = [];
  const lineRows: (typeof s.invoiceLines.$inferInsert)[] = [];
  const paymentRows: (typeof s.payments.$inferInsert)[] = [];
  for (const [clientName, entries] of Object.entries(invoiceable)) {
    const client = clientByName(clientName);
    const rate = (await db.select().from(s.clientRates).where(eq(s.clientRates.client_id, client.id)).limit(1))[0]!;
    const perTrip = rate.rate_type === 'per_trip';
    for (let i = 0; i < entries.length; i += 10) {
      const batch = entries.slice(i, i + 10);
      const issue = addDays(start, 20 + i);
      const invId = uid();
      const status = pick(['issued', 'issued', 'part_paid', 'paid', 'overdue'] as const);
      let subtotal = 0;
      for (const e of batch) {
        const qty = perTrip ? 1 : e.drops;
        const unit = Number(rate.amount);
        const lt = qty * unit;
        subtotal += lt;
        lineRows.push({
          invoice_id: invId, trip_id: e.tripId,
          description: perTrip ? 'Long-haul consignment' : `Delivery — ${qty} drop(s)`,
          quantity: m2(qty), unit_amount: m2(unit), line_total: m2(lt),
        });
      }
      const tax = subtotal * 0.16;
      const total = subtotal + tax;
      const paid = status === 'paid' ? total : status === 'part_paid' ? total * 0.5 : 0;
      invRows.push({
        id: invId, invoice_number: `BV-2026-${invNo++}`, client_id: client.id, status,
        issue_date: ymd(issue), due_date: ymd(addDays(issue, client.payment_terms_days)),
        subtotal: m2(subtotal), tax: m2(tax), total: m2(total), amount_paid: m2(paid),
      });
      if (paid > 0) {
        paymentRows.push({
          invoice_id: invId, amount: m2(paid), paid_at: ymd(addDays(issue, int(5, 20))),
          method: pick(['bank', 'mpesa'] as const), reference: `RCT${int(10000, 99999)}`,
        });
      }
    }
  }
  await bulk(s.invoices, invRows);
  await bulk(s.invoiceLines, lineRows);
  await bulk(s.payments, paymentRows);
  console.log(`  ${invRows.length} invoices, ${lineRows.length} lines`);

  console.log('done');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
