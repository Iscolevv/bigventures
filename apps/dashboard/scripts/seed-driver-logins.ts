/**
 * Give every seeded @bigventures.demo driver a password so you can sign in to
 * the mobile app as a driver. Idempotent.
 *
 *   cd apps/dashboard
 *   node --env-file=../../.env --import tsx scripts/seed-driver-logins.ts [password]
 *
 * Then sign in with e.g.  nahashon.gitau@bigventures.demo  /  driver1234
 */
import { randomUUID } from 'node:crypto';
import { auth } from '../lib/auth';
import { db, schema, eq, like } from '@bv/db';

const PASSWORD = process.argv[2] ?? 'driver1234';

async function main() {
  // Better Auth's password hasher (same one sign-in verifies against).
  const ctx = await auth.$context;

  const rows = await db
    .select({ id: schema.user.id, email: schema.user.email, name: schema.user.name })
    .from(schema.user)
    .innerJoin(schema.drivers, eq(schema.drivers.user_id, schema.user.id))
    .where(like(schema.user.email, '%@bigventures.demo'));

  for (const u of rows) {
    const existing = await db
      .select({ id: schema.account.id })
      .from(schema.account)
      .where(eq(schema.account.userId, u.id))
      .limit(1);
    const hash = await ctx.password.hash(PASSWORD);
    if (existing[0]) {
      await db.update(schema.account).set({ password: hash, updatedAt: new Date() }).where(eq(schema.account.id, existing[0].id));
      console.log(`updated  ${u.email} / ${PASSWORD}`);
    } else {
      await db.insert(schema.account).values({
        id: randomUUID(),
        accountId: u.id,
        providerId: 'credential',
        userId: u.id,
        password: hash,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      console.log(`created  ${u.email} / ${PASSWORD}`);
    }
    await db.update(schema.user).set({ emailVerified: true, role: 'driver', status: 'active' }).where(eq(schema.user.id, u.id));
  }
  console.log(`\n${rows.length} driver logins ready — password: ${PASSWORD}`);
}
main().then(() => process.exit(0));
