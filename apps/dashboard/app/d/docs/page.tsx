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
      <h1 className="text-lg font-semibold">My documents</h1>
      <p className="mt-1 text-sm text-muted">Photograph each one. The office reviews and files them.</p>

      <div className="mt-4 space-y-3">
        {MINE.map((def) => {
          const mine = docs.find((d) => d.type === def.type);
          return (
            <div key={def.type} className="rounded-xl border bg-surface p-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">
                  {def.label} {def.required && <span className="text-xs font-normal text-warn">· required</span>}
                </p>
                {mine && (
                  <span className={`text-xs font-semibold ${mine.status === 'valid' ? 'text-ok' : mine.status === 'rejected' ? 'text-crit' : 'text-warn'}`}>
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
