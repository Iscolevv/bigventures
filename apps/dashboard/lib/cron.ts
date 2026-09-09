import { NextResponse } from 'next/server';

/** Guard cron routes: Vercel Cron sends `Authorization: Bearer $CRON_SECRET`. */
export function assertCron(req: Request): NextResponse | null {
  const secret = process.env.CRON_SECRET;
  if (!secret) return null; // not configured → allow (dev)
  const auth = req.headers.get('authorization');
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  return null;
}
