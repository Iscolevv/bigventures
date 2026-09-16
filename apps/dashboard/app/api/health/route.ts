import { NextResponse } from 'next/server';
import { db, sql } from '@bv/db';
import { getSessionUser } from '@/lib/session';
import { storageBackend } from '@/lib/storage';

export const dynamic = 'force-dynamic';

/**
 * Config + connectivity check. Basic status is public; the detail view
 * (which services are wired) needs an admin/ops session.
 */
export async function GET() {
  const user = await getSessionUser();
  const privileged = user && (user.role === 'admin' || user.role === 'operations');

  let dbOk = false;
  try {
    await db.execute(sql`select 1`);
    dbOk = true;
  } catch {
    dbOk = false;
  }

  const base = { ok: dbOk, time: new Date().toISOString() };
  if (!privileged) return NextResponse.json(base);

  const out: Record<string, unknown> = {
    ...base,
    database: dbOk ? 'connected (bigventures schema)' : 'ERROR',
    fileStorage: storageBackend(),
    cronSecret: process.env.CRON_SECRET ? 'set (nightly job locked)' : 'not set (nightly job open)',
    betterAuthUrl: process.env.BETTER_AUTH_URL ?? '(auto from Vercel)',
  };

  return NextResponse.json(out);
}
