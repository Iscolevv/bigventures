import nodemailer from 'nodemailer';
import { db, sql } from '@bv/db';

/** Placeholder login emails can't receive mail - skip them. */
const PLACEHOLDER_DOMAIN = '@bigventures.demo';

export function mailConfigured() {
  return !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

/** Everyone who approves trips (admins + operations) with a real address, plus APPROVER_EMAILS. */
async function approverEmails(): Promise<string[]> {
  const res = await db.execute(sql`
    select email from bigventures."user"
    where role in ('admin','operations') and status = 'active'`);
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
  if (!mailConfigured()) return { sent: 0, reason: 'smtp not configured' };
  const to = await approverEmails();
  if (to.length === 0) return { sent: 0, reason: 'no approver emails' };

  const base = process.env.BETTER_AUTH_URL ?? 'https://www.venturesbig.com';
  const transport = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT ?? 465),
    secure: Number(process.env.SMTP_PORT ?? 465) === 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
  const lines = [
    `${t.driver} logged ${t.ref} on ${t.vehicle}.`,
    `${t.stops} stop${t.stops === 1 ? '' : 's'}${t.failed ? `, ${t.failed} failed` : ''}${t.fuelLitres ? `, ${t.fuelLitres} L fuel reported` : ''}.`,
    '',
    'It is not counted in the numbers until you approve it (add the fuel price there).',
    `${base}/approvals`,
  ];
  await transport.sendMail({
    from: process.env.MAIL_FROM ?? process.env.SMTP_USER,
    to,
    subject: `Approve ${t.ref}: ${t.driver}, ${t.vehicle}`,
    text: lines.join('\n'),
  });
  return { sent: to.length };
}
