/**
 * Create (or promote) a dashboard user with a password, using Better Auth so
 * the password hash is stored the way sign-in expects.
 *
 *   cd apps/dashboard
 *   npx tsx scripts/create-user.ts "Kevin" kevin@bigventures.co.ke 'a-strong-pass' operations
 *
 * roles: driver | operations | management | admin
 */
// Env must be loaded before ../lib/auth evaluates (it builds a pg Pool at
// import time). Run with:  node --env-file=../../.env --import tsx scripts/create-user.ts
import { auth } from '../lib/auth';
import { db, schema, eq } from '@bv/db';

const [name, email, password, role = 'admin'] = process.argv.slice(2);

if (!name || !email || !password) {
  console.error('usage: tsx scripts/create-user.ts "<name>" <email> <password> [role]');
  process.exit(1);
}
if (!['driver', 'operations', 'management', 'admin'].includes(role)) {
  console.error(`invalid role: ${role}`);
  process.exit(1);
}

async function main() {
  const existing = await db
    .select({ id: schema.user.id })
    .from(schema.user)
    .where(eq(schema.user.email, email!.toLowerCase()))
    .limit(1);

  if (existing[0]) {
    await db
      .update(schema.user)
      .set({ role: role as 'admin', status: 'active' })
      .where(eq(schema.user.id, existing[0].id));
    console.log(`updated existing user ${email} → role=${role}, status=active`);
    return;
  }

  const res = await auth.api.signUpEmail({
    body: { name: name!, email: email!.toLowerCase(), password: password! },
  });
  if (!res) throw new Error('sign-up returned nothing');

  await db
    .update(schema.user)
    .set({ role: role as 'admin', status: 'active' })
    .where(eq(schema.user.email, email!.toLowerCase()));

  console.log(`created ${email} with role=${role}, status=active`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
