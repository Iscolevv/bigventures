/**
 * The offline-sync contract between the driver app and the backend.
 *
 * The app holds a local queue of mutations made while offline. On reconnect it
 * POSTs one `SyncBatch` to `/api/mobile/sync`. Every entity carries a
 * client-generated UUID (`clientId`) so the server can upsert idempotently and
 * the app can reconcile server IDs back into its local store. Photos are
 * uploaded separately to presigned R2 URLs; the batch only references their
 * `storageKey`.
 */

import { z } from 'zod';
import {
  DROP_STATUSES,
  TRIP_STATUSES,
  CHECK_RESULTS,
  CHECK_ITEM_RESULTS,
  DELIVERY_ISSUE_CATEGORIES,
} from '../enums';

const uuid = z.string().uuid();
const isoDate = z.string().datetime({ offset: true });
const latLng = z.object({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180) });

export const trailPointSchema = latLng.extend({
  t: z.number().int(), // epoch ms
  speedKph: z.number().nonnegative().optional(),
  headingDeg: z.number().min(0).max(360).optional(),
  accuracyM: z.number().nonnegative().optional(),
});

export const syncTripSchema = z.object({
  clientId: uuid,
  serverId: uuid.optional(),
  vehicleId: uuid,
  routeId: uuid.optional(),
  status: z.enum(TRIP_STATUSES),
  loadingPointAddress: z.string().min(1).max(500),
  loading: latLng,
  cargoDescription: z.string().max(1000).optional(),
  clientRef: z.string().max(200).optional(),
  startedAt: isoDate.optional(),
  endedAt: isoDate.optional(),
  startOdometerKm: z.number().nonnegative().optional(),
  endOdometerKm: z.number().nonnegative().optional(),
  notes: z.string().max(2000).optional(),
  deviceId: z.string().max(200),
  updatedOnDeviceAt: isoDate,
});

export const syncDropSchema = z.object({
  clientId: uuid,
  serverId: uuid.optional(),
  tripClientId: uuid,
  sequence: z.number().int().positive(),
  destinationAddress: z.string().min(1).max(500),
  destination: latLng,
  status: z.enum(DROP_STATUSES),
  signeeName: z.string().max(200).optional(),
  issueCategory: z.enum(DELIVERY_ISSUE_CATEGORIES).optional(),
  issueNotes: z.string().max(2000).optional(),
  notes: z.string().max(2000).optional(),
  arrivedAt: isoDate.optional(),
  completedAt: isoDate.optional(),
  geofenceEnteredAt: isoDate.optional(),
  podPhotoKeys: z.array(z.string().max(500)).max(10).default([]),
  updatedOnDeviceAt: isoDate,
});

export const syncPodPhotoSchema = z.object({
  clientId: uuid,
  dropClientId: uuid,
  storageKey: z.string().max(500),
  capturedAt: isoDate,
  captured: latLng.optional(),
  sha256: z.string().length(64).optional(),
  fileSize: z.number().int().positive().optional(),
  /** camera capture only — the app rejects gallery picks before it gets here */
  source: z.literal('camera').default('camera'),
});

export const syncVehicleCheckSchema = z.object({
  clientId: uuid,
  serverId: uuid.optional(),
  tripClientId: uuid,
  vehicleId: uuid,
  performedAt: isoDate,
  overallResult: z.enum(CHECK_RESULTS),
  odometerKm: z.number().nonnegative().optional(),
  notes: z.string().max(2000).optional(),
  items: z
    .array(
      z.object({
        key: z.string().max(64),
        result: z.enum(CHECK_ITEM_RESULTS),
        value: z.string().max(200).optional(),
        photoKey: z.string().max(500).optional(),
        notes: z.string().max(1000).optional(),
      }),
    )
    .max(50),
});

export const syncFuelEntrySchema = z.object({
  clientId: uuid,
  serverId: uuid.optional(),
  vehicleId: uuid,
  tripClientId: uuid.optional(),
  litres: z.number().positive(),
  unitPrice: z.number().positive().optional(),
  totalCost: z.number().positive(),
  odometerKm: z.number().nonnegative(),
  station: z.string().max(200).optional(),
  receiptPhotoKey: z.string().max(500).optional(),
  filledAt: isoDate,
  notes: z.string().max(1000).optional(),
});

export const syncTrailSegmentSchema = z.object({
  clientId: uuid,
  tripClientId: uuid,
  points: z.array(trailPointSchema).min(1).max(2000),
});

export const syncDocumentSchema = z.object({
  clientId: uuid,
  docType: z.string().max(64),
  title: z.string().max(200),
  storageKey: z.string().max(500),
  mimeType: z.string().max(120),
  fileSize: z.number().int().positive().optional(),
  issueDate: isoDate.optional(),
  expiryDate: isoDate.optional(),
});

export const syncBatchSchema = z.object({
  batchId: uuid, // idempotency key for the whole POST
  deviceId: z.string().max(200),
  appVersion: z.string().max(40),
  generatedAt: isoDate,
  trips: z.array(syncTripSchema).max(100).default([]),
  drops: z.array(syncDropSchema).max(500).default([]),
  podPhotos: z.array(syncPodPhotoSchema).max(1000).default([]),
  vehicleChecks: z.array(syncVehicleCheckSchema).max(100).default([]),
  fuelEntries: z.array(syncFuelEntrySchema).max(200).default([]),
  trailSegments: z.array(syncTrailSegmentSchema).max(200).default([]),
  documents: z.array(syncDocumentSchema).max(50).default([]),
});

export type SyncBatch = z.infer<typeof syncBatchSchema>;
export type SyncTrip = z.infer<typeof syncTripSchema>;
export type SyncDrop = z.infer<typeof syncDropSchema>;

/** Server → app reconciliation response. */
export interface SyncResult {
  batchId: string;
  status: 'accepted' | 'partial' | 'rejected';
  /** clientId → serverId for every entity the server accepted */
  idMap: Record<string, string>;
  conflicts: Array<{
    clientId: string;
    entity: string;
    reason: string;
    /** current server state the app should adopt */
    serverState?: unknown;
  }>;
  /** entities the server rejected outright (validation, permission) */
  rejected: Array<{ clientId: string; entity: string; reason: string }>;
  serverTime: string;
}
