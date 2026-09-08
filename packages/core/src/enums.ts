/**
 * Single source of truth for every domain enum in Big Ventures.
 *
 * These are stored in Postgres as plain `text` columns (not native pg enums) so
 * that adding a value is an app-level change, never a migration. `packages/db`
 * imports these arrays to build `$type<...>()` annotations and check constraints.
 */

export const asConst = <T extends readonly string[]>(v: T) => v;

// --- People / access ------------------------------------------------------

export const ROLES = asConst(['driver', 'operations', 'management', 'admin'] as const);
export type Role = (typeof ROLES)[number];

export const USER_STATUSES = asConst(['active', 'suspended', 'invited', 'archived'] as const);
export type UserStatus = (typeof USER_STATUSES)[number];

export const DRIVER_STATUSES = asConst([
  'active',
  'on_leave',
  'suspended',
  'resigned',
  'absconded',
  'terminated',
] as const);
export type DriverStatus = (typeof DRIVER_STATUSES)[number];

// --- Fleet ---------------------------------------------------------------

export const VEHICLE_TYPES = asConst(['truck', 'van', 'trailer', 'pickup'] as const);
export type VehicleType = (typeof VEHICLE_TYPES)[number];

export const VEHICLE_STATUSES = asConst([
  'active',
  'in_repair',
  'grounded',
  'inactive',
  'sold',
] as const);
export type VehicleStatus = (typeof VEHICLE_STATUSES)[number];

// --- Trips / drops ------------------------------------------------------

export const TRIP_STATUSES = asConst([
  'draft', // created, not yet started
  'pre_check', // vehicle check in progress
  'in_progress', // left loading point
  'completed', // all drops closed + trip closed
  'cancelled',
  'flagged', // needs ops review (deviation, dispute, missing POD)
] as const);
export type TripStatus = (typeof TRIP_STATUSES)[number];

export const DROP_STATUSES = asConst([
  'pending',
  'arrived',
  'delivered',
  'partial',
  'failed',
  'returned',
] as const);
export type DropStatus = (typeof DROP_STATUSES)[number];

export const DELIVERY_ISSUE_CATEGORIES = asConst([
  'damage',
  'shortage',
  'rejected',
  'wrong_item',
  'access_denied',
  'customer_absent',
  'price_dispute',
  'other',
] as const);
export type DeliveryIssueCategory = (typeof DELIVERY_ISSUE_CATEGORIES)[number];

export const CHECK_RESULTS = asConst(['pass', 'fail', 'flagged'] as const);
export type CheckResult = (typeof CHECK_RESULTS)[number];

export const CHECK_ITEM_RESULTS = asConst(['pass', 'fail', 'na'] as const);
export type CheckItemResult = (typeof CHECK_ITEM_RESULTS)[number];

export const DEVIATION_TYPES = asConst([
  'off_route',
  'unscheduled_stop',
  'excessive_idle',
  'speeding',
  'after_hours_movement',
  'geofence_skip', // marked a drop delivered without entering its geofence
] as const);
export type DeviationType = (typeof DEVIATION_TYPES)[number];

// --- Money -------------------------------------------------------------

export const COST_CATEGORIES = asConst([
  'repair',
  'service',
  'tires',
  'insurance',
  'inspection',
  'parking',
  'police',
  'toll',
  'fine',
  'boda',
  'welding',
  'spares',
  'cleaning',
  'weighbridge',
  'permit',
  'other',
] as const);
export type CostCategory = (typeof COST_CATEGORIES)[number];

export const COST_STATUSES = asConst(['pending', 'approved', 'rejected'] as const);
export type CostStatus = (typeof COST_STATUSES)[number];

export const ENTRY_SOURCES = asConst(['mobile', 'dashboard', 'system', 'import'] as const);
export type EntrySource = (typeof ENTRY_SOURCES)[number];

export const ADVANCE_DIRECTIONS = asConst(['disbursed', 'repaid', 'written_off'] as const);
export type AdvanceDirection = (typeof ADVANCE_DIRECTIONS)[number];

export const PAYMENT_METHODS = asConst(['mpesa', 'cash', 'bank', 'cheque'] as const);
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const PAYROLL_STATUSES = asConst(['draft', 'approved', 'paid'] as const);
export type PayrollStatus = (typeof PAYROLL_STATUSES)[number];

// --- Clients / invoicing ----------------------------------------------

export const RATE_TYPES = asConst(['per_trip', 'per_km', 'per_drop', 'flat_monthly'] as const);
export type RateType = (typeof RATE_TYPES)[number];

export const INVOICE_STATUSES = asConst([
  'draft',
  'issued',
  'part_paid',
  'paid',
  'overdue',
  'void',
] as const);
export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];

// --- Documents -------------------------------------------------------

export const DOCUMENT_OWNER_TYPES = asConst(['driver', 'vehicle', 'company'] as const);
export type DocumentOwnerType = (typeof DOCUMENT_OWNER_TYPES)[number];

export const DOCUMENT_TYPES = asConst([
  // driver
  'drivers_license',
  'good_conduct',
  'nssf',
  'shif',
  'national_id',
  'employment_contract',
  'psv_badge',
  // vehicle
  'insurance_certificate',
  'ntsa_inspection',
  'logbook',
  'tgl_license', // transporting goods licence
  'speed_governor',
  // company
  'certificate_of_incorporation',
  'kra_pin',
  'business_permit',
  'cr12',
  'other',
] as const);
export type DocumentType = (typeof DOCUMENT_TYPES)[number];

export const DOCUMENT_STATUSES = asConst([
  'valid',
  'expiring_soon',
  'expired',
  'pending_review',
  'rejected',
  'missing',
] as const);
export type DocumentStatus = (typeof DOCUMENT_STATUSES)[number];

// --- Alerts ---------------------------------------------------------

export const ALERT_TYPES = asConst([
  'failed_check',
  'delivery_issue',
  'fuel_anomaly',
  'document_expiry',
  'overdue_advance',
  'route_deviation',
  'overdue_invoice',
  'maintenance_due',
  'missing_pod',
  'idle_vehicle',
] as const);
export type AlertType = (typeof ALERT_TYPES)[number];

export const ALERT_SEVERITIES = asConst(['info', 'warning', 'critical'] as const);
export type AlertSeverity = (typeof ALERT_SEVERITIES)[number];

export const ALERT_STATUSES = asConst([
  'open',
  'acknowledged',
  'resolved',
  'dismissed',
] as const);
export type AlertStatus = (typeof ALERT_STATUSES)[number];

// --- Audit / sync --------------------------------------------------

export const AUDIT_ACTIONS = asConst([
  'create',
  'update',
  'delete',
  'approve',
  'reject',
  'override',
  'login',
  'export',
  'sync',
] as const);
export type AuditAction = (typeof AUDIT_ACTIONS)[number];

export const SYNC_BATCH_STATUSES = asConst([
  'accepted',
  'partial',
  'rejected',
] as const);
export type SyncBatchStatus = (typeof SYNC_BATCH_STATUSES)[number];
