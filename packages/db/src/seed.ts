import { config } from 'dotenv';
config({ path: ['.env', '../../.env'] });
import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { getDb } from './index';
import * as s from './schema';
import { DEFAULT_INCENTIVE_CONFIG } from '@bv/core/calc';

/**
 * Seeds a demo dataset drawn from the Big Ventures Jan–Aug 2026 expense book:
 * the real fleet (8 units), a few drivers, clients, routes, and an active
 * incentive rule. Enough to make every dashboard view render with real shapes.
 *
 *   pnpm db:seed
 */
async function main() {
  const db = getDb();
  console.log('seeding…');

  // --- settings + incentive rule ------------------------------------
  await db
    .insert(s.settings)
    .values({ key: 'default', company_name: 'Big Ventures', invoice_tax_pct: '16', invoice_prefix: 'BV', trip_prefix: 'TRP' })
    .onConflictDoNothing();

  const ruleId = randomUUID();
  await db
    .insert(s.incentiveRules)
    .values({
      id: ruleId,
      name: 'Standard 2026',
      active: true,
      effective_from: '2026-01-01',
      config: DEFAULT_INCENTIVE_CONFIG,
    })
    .onConflictDoNothing();
  await db
    .update(s.settings)
    .set({ active_incentive_rule_id: ruleId })
    .where(eq(s.settings.key, 'default'));

  // --- vehicles ---------------------------------------------------
  // monthly_finance_cost ≈ per-unit share of the Jan SACCO contributions
  const vehicleRows = [
    { registration: 'KCD 448E', vehicle_type: 'van' as const, monthly_finance_cost: '24000' },
    { registration: 'KCM 850A', vehicle_type: 'van' as const, monthly_finance_cost: '24000' },
    { registration: 'KCY 046L', vehicle_type: 'van' as const, monthly_finance_cost: '24000' },
    { registration: 'KDJ 483Z', vehicle_type: 'truck' as const, monthly_finance_cost: '68000' },
    { registration: 'KDE 322N', vehicle_type: 'pickup' as const, monthly_finance_cost: '17000' },
    { registration: 'KDM 822D', vehicle_type: 'pickup' as const, monthly_finance_cost: '17000' },
    { registration: 'KDT 121S', vehicle_type: 'pickup' as const, monthly_finance_cost: '17000' },
    { registration: 'KDP 150M', vehicle_type: 'pickup' as const, monthly_finance_cost: '17000' },
  ];
  const vehicles = await db.insert(s.vehicles).values(vehicleRows).onConflictDoNothing().returning();
  console.log(`  ${vehicles.length} vehicles`);

  // --- users + drivers ------------------------------------------
  const driverSeeds = [
    { name: 'Nahashon Gitau', phone: '+254700000001', base: '30000' },
    { name: 'Simon Wanyoike', phone: '+254700000002', base: '25000' },
    { name: 'Dismas Otieno', phone: '+254700000003', base: '20000' },
    { name: 'Tony Kimani', phone: '+254700000004', base: '30000' },
  ];
  for (const d of driverSeeds) {
    const userId = randomUUID();
    const email = `${d.name.toLowerCase().replace(/\s+/g, '.')}@bigventures.demo`;
    await db
      .insert(s.user)
      .values({ id: userId, name: d.name, email, role: 'driver', status: 'active', phone: d.phone })
      .onConflictDoNothing();
    await db
      .insert(s.drivers)
      .values({
        user_id: userId,
        full_name: d.name,
        phone: d.phone,
        base_salary: d.base,
        status: 'active',
        date_joined: '2026-01-01',
      })
      .onConflictDoNothing();
  }

  // ops + management accounts
  await db
    .insert(s.user)
    .values([
      { id: randomUUID(), name: 'Kevin (Operations)', email: 'kevin@bigventures.demo', role: 'operations', status: 'active' },
      { id: randomUUID(), name: 'Raha (Management)', email: 'raha@bigventures.demo', role: 'management', status: 'active' },
    ])
    .onConflictDoNothing();

  const allDrivers = await db.select().from(s.drivers);
  const allVehicles = await db.select().from(s.vehicles);

  // --- assignments ------------------------------------------------
  for (let i = 0; i < allDrivers.length && i < allVehicles.length; i++) {
    await db
      .insert(s.vehicleAssignments)
      .values({
        vehicle_id: allVehicles[i]!.id,
        driver_id: allDrivers[i]!.id,
        start_date: '2026-01-01',
      })
      .onConflictDoNothing();
  }

  // --- clients --------------------------------------------------
  await db
    .insert(s.clients)
    .values([
      { name: 'Ajab Flour', contact_name: 'Procurement', payment_terms_days: 30 },
      { name: 'Papa Distributors', payment_terms_days: 14 },
      { name: 'MEDS Kitui', payment_terms_days: 45 },
    ])
    .onConflictDoNothing();

  // --- routes --------------------------------------------------
  await db
    .insert(s.routes)
    .values([
      { name: 'CST Yard → Nairobi CBD drops', origin_label: 'CST Yard', origin_lat: -1.309, origin_lng: 36.851 },
      { name: 'JG Road → Mombasa', origin_label: 'JG Road Depot', origin_lat: -1.283, origin_lng: 36.826 },
      { name: 'Ojijo Road local runs', origin_label: 'Ojijo Road', origin_lat: -1.263, origin_lng: 36.813 },
    ])
    .onConflictDoNothing();

  console.log('done');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
