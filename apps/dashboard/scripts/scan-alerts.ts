// Run the alert engine once against DATABASE_URL.
//   node --env-file=../../.env --import tsx scripts/scan-alerts.ts
import { db } from '@bv/db';
import { runAlertScan } from '../lib/alert-engine';

runAlertScan(db).then((n) => {
  console.log(`alert scan complete — ${n} new alert(s) raised`);
  process.exit(0);
});
