/**
 * Reference / configuration data that ships with the app. Not in the database
 * because changing it is a code review, not a data edit — but centralised here
 * so the mobile checklist, the dashboard, and the alert engine never drift.
 */

import type { DocumentType, DocumentOwnerType, AlertType } from './enums';

// --- Pre-trip vehicle check --------------------------------------------

export interface CheckItemDef {
  key: string;
  label: string;
  /** a `fail` here blocks the trip from starting until ops overrides */
  blocking: boolean;
  /** prompt the driver for a photo when the result is `fail` */
  photoOnFail: boolean;
  /** free-text/measured value expected alongside pass/fail (e.g. fuel level) */
  valueHint?: string;
}

export const VEHICLE_CHECK_TEMPLATE: readonly CheckItemDef[] = [
  { key: 'tires', label: 'Tyres & pressure (incl. spare)', blocking: true, photoOnFail: true },
  { key: 'brakes', label: 'Brakes & handbrake', blocking: true, photoOnFail: false },
  { key: 'lights', label: 'Headlights, indicators, brake lights', blocking: true, photoOnFail: true },
  { key: 'mirrors_glass', label: 'Mirrors & windscreen', blocking: false, photoOnFail: true },
  { key: 'engine_oil', label: 'Engine oil level', blocking: false, photoOnFail: false },
  { key: 'coolant', label: 'Coolant / water level', blocking: false, photoOnFail: false },
  {
    key: 'fuel_level',
    label: 'Fuel level at start',
    blocking: false,
    photoOnFail: false,
    valueHint: 'e.g. 1/2, 3/4, Full',
  },
  { key: 'body_damage', label: 'Visible body damage', blocking: false, photoOnFail: true },
  { key: 'cargo_secure', label: 'Load secured / tail-lift & straps', blocking: true, photoOnFail: true },
  { key: 'documents', label: 'Logbook, insurance & inspection in cab', blocking: true, photoOnFail: false },
  { key: 'first_aid_fire', label: 'First-aid kit & fire extinguisher', blocking: false, photoOnFail: false },
  { key: 'speed_governor', label: 'Speed governor sealed & working', blocking: false, photoOnFail: true },
];

export const BLOCKING_CHECK_KEYS = new Set(
  VEHICLE_CHECK_TEMPLATE.filter((c) => c.blocking).map((c) => c.key),
);

// --- Documents --------------------------------------------------------

export interface DocumentTypeDef {
  type: DocumentType;
  owner: DocumentOwnerType;
  label: string;
  hasExpiry: boolean;
  /** days before expiry to start warning */
  warnDays: number;
  /** required for the owner to be considered compliant */
  required: boolean;
}

export const DOCUMENT_TYPE_DEFS: readonly DocumentTypeDef[] = [
  // driver
  { type: 'drivers_license', owner: 'driver', label: "Driver's licence", hasExpiry: true, warnDays: 45, required: true },
  { type: 'good_conduct', owner: 'driver', label: 'Certificate of good conduct', hasExpiry: true, warnDays: 60, required: true },
  { type: 'nssf', owner: 'driver', label: 'NSSF', hasExpiry: false, warnDays: 0, required: true },
  { type: 'shif', owner: 'driver', label: 'SHIF', hasExpiry: false, warnDays: 0, required: true },
  { type: 'national_id', owner: 'driver', label: 'National ID', hasExpiry: false, warnDays: 0, required: true },
  { type: 'employment_contract', owner: 'driver', label: 'Employment contract', hasExpiry: false, warnDays: 0, required: false },
  { type: 'psv_badge', owner: 'driver', label: 'PSV badge', hasExpiry: true, warnDays: 30, required: false },
  // vehicle
  { type: 'insurance_certificate', owner: 'vehicle', label: 'Insurance certificate', hasExpiry: true, warnDays: 30, required: true },
  { type: 'ntsa_inspection', owner: 'vehicle', label: 'NTSA inspection', hasExpiry: true, warnDays: 30, required: true },
  { type: 'logbook', owner: 'vehicle', label: 'Logbook', hasExpiry: false, warnDays: 0, required: true },
  { type: 'tgl_license', owner: 'vehicle', label: 'Transporting Goods Licence (TGL)', hasExpiry: true, warnDays: 30, required: false },
  { type: 'speed_governor', owner: 'vehicle', label: 'Speed governor certificate', hasExpiry: true, warnDays: 30, required: false },
  // company
  { type: 'certificate_of_incorporation', owner: 'company', label: 'Certificate of incorporation', hasExpiry: false, warnDays: 0, required: true },
  { type: 'kra_pin', owner: 'company', label: 'KRA PIN certificate', hasExpiry: false, warnDays: 0, required: true },
  { type: 'business_permit', owner: 'company', label: 'Business permit', hasExpiry: true, warnDays: 45, required: true },
  { type: 'cr12', owner: 'company', label: 'CR12', hasExpiry: true, warnDays: 90, required: false },
];

export const DOCUMENT_TYPE_BY_KEY: Record<DocumentType, DocumentTypeDef> = Object.fromEntries(
  DOCUMENT_TYPE_DEFS.map((d) => [d.type, d]),
) as Record<DocumentType, DocumentTypeDef>;

// --- Alert thresholds ------------------------------------------------

export const ALERT_THRESHOLDS = {
  /** advance older than this many days with no repayment → overdue_advance */
  advanceOverdueDays: 45,
  /** invoice past due date by this many days → overdue_invoice */
  invoiceOverdueGraceDays: 3,
  /** vehicle with no completed trip in this many days → idle_vehicle */
  vehicleIdleDays: 5,
  /** service due within this many km of current odometer → maintenance_due */
  serviceDueKm: 1500,
  /** delivered drop still missing a POD photo after this many hours */
  missingPodHours: 12,
  /** consecutive off-route trail points before raising route_deviation */
  deviationPointStreak: 4,
} as const;

export const ALERT_SEVERITY_DEFAULT: Record<AlertType, 'info' | 'warning' | 'critical'> = {
  failed_check: 'critical',
  delivery_issue: 'warning',
  fuel_anomaly: 'warning',
  document_expiry: 'warning',
  overdue_advance: 'warning',
  route_deviation: 'warning',
  overdue_invoice: 'warning',
  maintenance_due: 'info',
  missing_pod: 'warning',
  idle_vehicle: 'info',
};

/** Payroll / incentive periods are calendar months, keyed "YYYY-MM". */
export function periodKey(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}
