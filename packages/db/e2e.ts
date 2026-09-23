import { db, sql } from './src/index';
import * as q from './src/queries';
const BASE = 'https://www.venturesbig.com';
const H = { origin: BASE, 'user-agent': 'Mozilla/5.0 (test)' };
const r0 = await fetch(BASE + '/api/auth/sign-in/email', { method: 'POST', headers: { ...H, 'content-type': 'application/json' }, body: JSON.stringify({ email: 'kevin@bigventures.demo', password: 'office1234' }) });
const cookie = r0.headers.getSetCookie().map((c) => c.split(';')[0]).join('; ');
const get = async (p: string) => { const r = await fetch(BASE + p, { headers: { ...H, cookie }, redirect: 'manual' }); return { status: r.status, text: await r.text() }; };
function forms(html: string) {
  const out: { action: string; html: string }[] = [];
  for (const m of html.matchAll(/<form[^>]*>([\s\S]*?)<\/form>/g)) {
    const a = m[1]!.match(/name="(\$ACTION_ID_[a-f0-9]+)"/);
    if (a) out.push({ action: a[1]!, html: m[1]! });
  }
  return out;
}
async function post(path: string, form: { action: string }, fields: Record<string, string>) {
  const fd = new FormData(); fd.set(form.action, '');
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  const r = await fetch(BASE + path, { method: 'POST', headers: { ...H, cookie }, body: fd, redirect: 'manual' });
  return `${r.status} ${decodeURIComponent(r.headers.get('location') ?? '').slice(0, 120)}`;
}
const find = (fs: { html: string }[], needle: string) => fs.find((f) => f.html.includes(needle))!;

// wait for deploy
for (let i = 0; i < 20; i++) { const r = await get('/weekly'); if (r.status === 200) { console.log('deployed (try', i + 1, ')'); break; } await new Promise((r) => setTimeout(r, 15000)); }

// 1 sidebar
const home = (await get('/')).text;
console.log('sidebar has:', ['Weekly sheet', 'Approvals', 'Team &amp; logins', 'Incentives', 'Fuel', 'Alerts', 'Daily sheet'].filter((t) => home.includes('>' + t + '<') || home.includes(t + '</a>')));

// 2 the weekly sheet numbers (week containing the trips: Mon 21 Sep 2026)
const s = await q.weeklySheet(db, '2026-09-21');
console.table(s.rows.filter((r) => r.income || r.expenses).map((r) => ({ reg: r.registration, cells: r.cells.map((c) => c.income || c.note || '').join(' | '), income: r.income, expenses: r.expenses, total: r.total })));
console.log('week totals', s.totals, 'other', s.otherExpenses);
const page = await get('/weekly?week=2026-09-21');
console.log('page', page.status, 'shows 70,000:', page.text.includes('70,000'), '15,000:', page.text.includes('15,000'), 'WEEK TOTAL:', page.text.includes('WEEK TOTAL'));
const csv = await get('/api/export/weekly?week=2026-09-21');
console.log('csv', csv.status, csv.text.split('\n').slice(0, 3).join(' // ').slice(0, 260));

// 3 status note round trip (same SQL as the action), shown on the sheet, then removed
const veh = (await db.execute(sql`select id from bigventures.vehicles where registration='KDE 322N'`)).rows[0] as any;
await db.execute(sql`insert into bigventures.vehicle_day_notes (vehicle_id, day, note) values (${veh.id}, '2026-09-22'::date, 'PKD JGRD')`);
const s2 = await q.weeklySheet(db, '2026-09-21');
console.log('note on KDE 322N Tue:', s2.rows.find((r) => r.registration === 'KDE 322N')!.cells[1]);
console.log('page shows PKD JGRD:', (await get('/weekly?week=2026-09-21')).text.includes('PKD JGRD'));
await db.execute(sql`delete from bigventures.vehicle_day_notes where vehicle_id=${veh.id}`);

// 4 team: add -> rename -> refuse self-delete -> delete
let html = (await get('/team')).text;
console.log('add login:', await post('/team', find(forms(html), 'name="password"'), { name: 'Zz Temp', email: 'zz.temp@bigventures.demo', role: 'management', password: 'testpass123' }));
html = (await get('/team')).text;
const tmp = (await db.execute(sql`select id from bigventures."user" where email='zz.temp@bigventures.demo'`)).rows[0] as any;
const upd = forms(html).find((f) => f.html.includes(`value="${tmp.id}"`) && f.html.includes('name="role"'))!;
console.log('rename:', await post('/team', upd, { id: tmp.id, name: 'Zz Renamed', email: 'zz.temp@bigventures.demo', role: 'operations', status: 'active', password: '' }));
console.log('  ->', (await db.execute(sql`select name, role from bigventures."user" where id=${tmp.id}`)).rows[0]);
const kev = (await db.execute(sql`select id from bigventures."user" where email='kevin@bigventures.demo'`)).rows[0] as any;
html = (await get('/team')).text;
const delTmp = forms(html).find((f) => f.html.includes(`value="${tmp.id}"`) && !f.html.includes('name="role"'))!;
console.log('delete temp:', await post('/team', delTmp, { id: tmp.id }), '->', (await db.execute(sql`select count(*)::int n from bigventures."user" where id=${tmp.id}`)).rows[0]);
console.log('self-delete refused (no delete form for self):', !forms(html).some((f) => f.html.includes(`value="${kev.id}"`) && !f.html.includes('name="role"')));
// server-side guard even if someone forges it
console.log('forged self-delete:', await post('/team', delTmp, { id: kev.id }), '-> still there:', (await db.execute(sql`select count(*)::int n from bigventures."user" where id=${kev.id}`)).rows[0]);

// 5 driver: delete refused with trips, allowed without
const nah = (await db.execute(sql`select id from bigventures.drivers where full_name='Nahashon Gitau'`)).rows[0] as any;
let dh = (await get('/drivers/' + nah.id)).text;
console.log('delete driver with trips:', await post('/drivers/' + nah.id, find(forms(dh), 'name="id"' ) , { id: nah.id }));
