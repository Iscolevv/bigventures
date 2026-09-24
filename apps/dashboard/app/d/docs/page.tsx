import { CheckCircle2, Clock, FileText, XCircle } from 'lucide-react';
import { requireDriver } from '@/lib/driver-session';
import { db, schema, eq, and } from '@bv/db';
import { DOCUMENT_TYPE_DEFS } from '@bv/core/reference';
import { DriverDocForm } from '@/components/driver/DriverDocForm';

export const dynamic = 'force-dynamic';

const MINE = DOCUMENT_TYPE_DEFS.filter((d) => d.owner === 'driver');

export default async function DriverDocs() {
  const me = await requireDriver();
  const docs = await db
    .select({ type: schema.documents.doc_type, status: schema.documents.status, expiry: schema.documents.expiry_date })
    .from(schema.documents)
    .where(and(eq(schema.documents.owner_type, 'driver'), eq(schema.documents.owner_id, me.driverId)));

  return (
    <>
      <div className="flex items-center gap-3">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-brand/10 text-brand">
          <FileText size={22} />
        </span>
        <div>
          <h1 className="text-lg font-semibold leading-tight">My documents</h1>
          <p className="text-sm text-muted">Photograph each one. The office reviews and files them.</p>
        </div>
      </div>

      <div className="mt-4 space-y-3">
        {MINE.map((def) => {
          const mine = docs.find((d) => d.type === def.type);
          const tone = !mine ? '' : mine.status === 'valid' ? 'text-ok' : mine.status === 'rejected' ? 'text-crit' : 'text-warn';
          const StatusIcon = !mine ? null : mine.status === 'valid' ? CheckCircle2 : mine.status === 'rejected' ? XCircle : Clock;
          return (
            <div key={def.type} className="rounded-2xl border bg-surface p-3.5">
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-medium">
                  {def.label} {def.required && <span className="text-xs font-normal text-warn">· required</span>}
                </p>
                {mine && StatusIcon && (
                  <span className={`inline-flex shrink-0 items-center gap-1 text-xs font-semibold capitalize ${tone}`}>
                    <StatusIcon size={15} />
                    {mine.status.replace('_', ' ')}
                  </span>
                )}
              </div>
              <DriverDocForm docType={def.type} hasExpiry={def.hasExpiry} replace={!!mine} />
            </div>
          );
        })}
      </div>
    </>
  );
}
