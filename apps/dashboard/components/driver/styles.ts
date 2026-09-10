/** Shared class strings for the driver PWA — mobile-first: 16px inputs (no iOS
 *  zoom), ~48px tap targets, tap feedback instead of hover. */
export const dInput =
  'mt-1 w-full rounded-lg border border-border bg-surface px-3.5 py-3 text-base leading-normal outline-none focus:border-brand';
export const dLabel = 'block text-sm font-medium';
export const dBtn =
  'w-full rounded-lg px-4 py-3.5 text-center text-base font-semibold active:opacity-90 disabled:opacity-50';
export const dBtnPrimary = `${dBtn} bg-brand text-white`;
export const dBtnOutline = `${dBtn} border border-brand bg-transparent text-brand active:bg-brand/10`;
export const dBtnOk = `${dBtn} bg-ok text-white`;
export const dBtnWarn = `${dBtn} bg-warn text-white`;
export const dBtnCrit = `${dBtn} bg-crit text-white`;
/** small secondary button — still a comfortable tap target */
export const dChip =
  'min-h-[40px] rounded-full border px-3.5 py-2 text-sm active:opacity-80';
