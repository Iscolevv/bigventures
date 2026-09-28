import { Resend } from 'resend';
import { db, sql } from '@bv/db';

/** Placeholder login emails can't receive mail - skip them. */
const PLACEHOLDER_DOMAIN = '@bigventures.demo';

export function mailConfigured() {
  return !!process.env.RESEND_API_KEY;
}

/** Everyone who approves trips (admins + operations) with a real address, plus APPROVER_EMAILS. */
async function approverEmails(): Promise<string[]> {
  const res = await db.execute(sql`
    select email from bigventures."user"
    where role in ('admin','operations') and status = 'active' and hidden = false`);
  const fromDb = (res.rows as { email: string }[]).map((r) => r.email).filter((e) => !e.toLowerCase().endsWith(PLACEHOLDER_DOMAIN));
  const extra = (process.env.APPROVER_EMAILS ?? '').split(',').map((e) => e.trim()).filter(Boolean);
  return [...new Set([...fromDb, ...extra].map((e) => e.toLowerCase()))];
}

export async function notifyTripSubmitted(t: {
  ref: string;
  driver: string;
  vehicle: string;
  stops: number;
  failed: number;
  fuelLitres: number | null;
}) {
  if (!mailConfigured()) return { sent: 0, reason: 'resend not configured' };
  const to = await approverEmails();
  if (to.length === 0) return { sent: 0, reason: 'no approver emails' };

  const base = process.env.BETTER_AUTH_URL ?? 'https://www.venturesbig.com';
  const resend = new Resend(process.env.RESEND_API_KEY);
  const lines = [
    `${t.driver} logged ${t.ref} on ${t.vehicle}.`,
    `${t.stops} stop${t.stops === 1 ? '' : 's'}${t.failed ? `, ${t.failed} failed` : ''}${t.fuelLitres ? `, ${t.fuelLitres} L fuel reported` : ''}.`,
    '',
    'It is not counted in the numbers until you approve it (add the fuel price there).',
    `${base}/approvals`,
  ];
  const { error } = await resend.emails.send({
    from: process.env.MAIL_FROM ?? 'Big Ventures <notify@venturesbig.com>',
    to,
    subject: `Approve ${t.ref}: ${t.driver}, ${t.vehicle}`,
    text: lines.join('\n'),
  });
  if (error) return { sent: 0, reason: error.message };
  return { sent: to.length };
}
