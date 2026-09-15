/**
 * Give the demo operations/management accounts a password too
 * (seed-driver-logins.ts only covers users that have a driver profile).
 * Uses Better Auth's own hasher via auth.$context, same as seed-driver-logins.
 *
 *   cd apps/dashboard
 *   node --env-file=../../.env --import tsx scripts/seed-office-logins.ts [password]
 */
import { randomUUID } from 'node:crypto';
import { auth } from '../lib/auth';
import { db, schema, eq, and, inArray, like } from '@bv/db';

const PASSWORD = process.argv[2] ?? 'office1234';

async function main() {
  const ctx = await auth.$context;

  const rows = await db
    .select({ id: schema.user.id, email: schema.user.email })
    .from(schema.user)
    .where(and(like(schema.user.email, '%@bigventures.demo'), inArray(schema.user.role, ['operations', 'management'])));

  for (const u of rows) {
    const existing = await db
      .select({ id: schema.account.id })
      .from(schema.account)
      .where(eq(schema.account.userId, u.id))
      .limit(1);
    const hashed = await ctx.password.hash(PASSWORD);
    if (existing[0]) {
      await db.update(schema.account).set({ password: hashed, updatedAt: new Date() }).where(eq(schema.account.id, existing[0].id));
      console.log(`updated  ${u.email} / ${PASSWORD}`);
    } else {
      await db.insert(schema.account).values({
        id: randomUUID(),
        accountId: u.id,
        providerId: 'credential',
        userId: u.id,
        password: hashed,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      console.log(`created  ${u.email} / ${PASSWORD}`);
    }
    await db.update(schema.user).set({ emailVerified: true, status: 'active' }).where(eq(schema.user.id, u.id));
  }
  console.log(`\n${rows.length} office login(s) ready - password: ${PASSWORD}`);
}
main().then(() => process.exit(0));
