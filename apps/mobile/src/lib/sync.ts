/**
 * The sync loop. Builds a SyncBatch from every 'dirty' row, uploads any pending
 * photos first, POSTs the batch, then reconciles server IDs back into SQLite.
 *
 * Safe to call anytime — idempotent on both ends (batchId + per-entity
 * client_uuid). Call it on app foreground, on connectivity regained, after any
 * local mutation, and on a timer while a trip is active.
 */
import * as Crypto from 'expo-crypto';
import type { dto } from '@bv/core';
import { db, setMeta } from './localdb';
import { apiFetch, getDeviceId } from './auth';
import { uploadFile } from './uploads';
import Constants from 'expo-constants';

type SyncBatch = ReturnType<typeof dto.syncBatchSchema.parse>;

let running = false;

export async function runSync(): Promise<{ status: string } | { skipped: true }> {
  if (running) return { skipped: true };
  running = true;
  try {
    await uploadPendingFiles();
    const batch = buildBatch();
    if (isEmpty(batch)) return { status: 'nothing-to-sync' };

    markSyncing(batch);
    const res = await apiFetch('/api/mobile/sync', {
      method: 'POST',
      body: JSON.stringify(batch),
    });
    if (!res.ok) {
      revertSyncing(batch);
      throw new Error(`sync failed: ${res.status}`);
    }
    const result = (await res.json()) as dto.SyncResult;
    reconcile(result);
    setMeta('lastSyncAt', new Date().toISOString());
    return { status: result.status };
  } finally {
    running = false;
  }
}

async function uploadPendingFiles() {
  const d = db();
  const photos = d.getAllSync<{ client_id: string; local_uri: string; sha256: string; file_size: number }>(
    "SELECT client_id, local_uri, sha256, file_size FROM pod_photos WHERE upload_state = 'pending'",
  );
  for (const p of photos) {
    try {
      const key = await uploadFile('pod', {
        uri: p.local_uri,
        sha256: p.sha256,
        size: p.file_size,
        contentType: 'image/jpeg',
      }, `${p.client_id}.jpg`);
      d.runSync("UPDATE pod_photos SET storage_key = ?, upload_state = 'done' WHERE client_id = ?", [key, p.client_id]);
    } catch {
      // leave pending; next run retries
    }
  }

  const receipts = d.getAllSync<{ client_id: string; receipt_local_uri: string }>(
    "SELECT client_id, receipt_local_uri FROM fuel_entries WHERE receipt_local_uri IS NOT NULL AND receipt_storage_key IS NULL",
  );
  for (const r of receipts) {
    try {
      const key = await uploadFile('receipt', { uri: r.receipt_local_uri, sha256: '', size: 0, contentType: 'image/jpeg' }, `${r.client_id}.jpg`);
      d.runSync('UPDATE fuel_entries SET receipt_storage_key = ? WHERE client_id = ?', [key, r.client_id]);
    } catch {
      /* retry next run */
    }
  }
}

function buildBatch(): SyncBatch {
  const d = db();
  const dirty = (t: string) => `sync_state IN ('dirty')`;

  const trips = d.getAllSync<any>(`SELECT * FROM trips WHERE ${dirty('trips')}`).map((t) => ({
    clientId: t.client_id,
    serverId: t.server_id ?? undefined,
    vehicleId: t.vehicle_id,
    routeId: t.route_id ?? undefined,
    status: t.status,
    loadingPointAddress: t.loading_address,
    loading: { lat: t.loading_lat, lng: t.loading_lng },
    cargoDescription: t.cargo_description ?? undefined,
    clientRef: t.client_ref ?? undefined,
    startedAt: t.started_at ?? undefined,
    endedAt: t.ended_at ?? undefined,
    startOdometerKm: t.start_odometer_km ?? undefined,
    endOdometerKm: t.end_odometer_km ?? undefined,
    notes: t.notes ?? undefined,
    deviceId: getDeviceIdSync(),
    updatedOnDeviceAt: t.updated_at,
  }));

  const drops = d.getAllSync<any>(`SELECT * FROM drops WHERE ${dirty('drops')}`).map((x) => ({
    clientId: x.client_id,
    serverId: x.server_id ?? undefined,
    tripClientId: x.trip_client_id,
    sequence: x.sequence,
    destinationAddress: x.destination_address,
    destination: { lat: x.dest_lat, lng: x.dest_lng },
    status: x.status,
    signeeName: x.signee_name ?? undefined,
    issueCategory: x.issue_category ?? undefined,
    issueNotes: x.issue_notes ?? undefined,
    notes: x.notes ?? undefined,
    arrivedAt: x.arrived_at ?? undefined,
    completedAt: x.completed_at ?? undefined,
    geofenceEnteredAt: x.geofence_entered_at ?? undefined,
    podPhotoKeys: d
      .getAllSync<{ storage_key: string }>(
        "SELECT storage_key FROM pod_photos WHERE drop_client_id = ? AND storage_key IS NOT NULL",
        [x.client_id],
      )
      .map((p) => p.storage_key),
    updatedOnDeviceAt: x.updated_at,
  }));

  const podPhotos = d
    .getAllSync<any>("SELECT * FROM pod_photos WHERE sync_state = 'dirty' AND storage_key IS NOT NULL")
    .map((p) => ({
      clientId: p.client_id,
      dropClientId: p.drop_client_id,
      storageKey: p.storage_key,
      capturedAt: p.captured_at,
      captured: p.captured_lat != null ? { lat: p.captured_lat, lng: p.captured_lng } : undefined,
      sha256: p.sha256 ?? undefined,
      fileSize: p.file_size ?? undefined,
      source: 'camera' as const,
    }));

  const vehicleChecks = d.getAllSync<any>("SELECT * FROM vehicle_checks WHERE sync_state = 'dirty'").map((c) => ({
    clientId: c.client_id,
    serverId: c.server_id ?? undefined,
    tripClientId: c.trip_client_id,
    vehicleId: c.vehicle_id,
    performedAt: c.performed_at,
    overallResult: c.overall_result,
    odometerKm: c.odometer_km ?? undefined,
    notes: c.notes ?? undefined,
    items: JSON.parse(c.items_json ?? '[]'),
  }));

  const fuelEntries = d.getAllSync<any>("SELECT * FROM fuel_entries WHERE sync_state = 'dirty'").map((f) => ({
    clientId: f.client_id,
    serverId: f.server_id ?? undefined,
    vehicleId: f.vehicle_id,
    tripClientId: f.trip_client_id ?? undefined,
    litres: f.litres,
    unitPrice: f.unit_price ?? undefined,
    totalCost: f.total_cost,
    odometerKm: f.odometer_km,
    station: f.station ?? undefined,
    receiptPhotoKey: f.receipt_storage_key ?? undefined,
    filledAt: f.filled_at,
    notes: f.notes ?? undefined,
  }));

  const trailSegments = d.getAllSync<any>("SELECT * FROM trail_segments WHERE sync_state = 'dirty'").map((s) => ({
    clientId: s.client_id,
    tripClientId: s.trip_client_id,
    points: JSON.parse(s.points_json),
  }));

  const documents = d.getAllSync<any>("SELECT * FROM documents WHERE sync_state = 'dirty' AND storage_key IS NOT NULL").map((x) => ({
    clientId: x.client_id,
    docType: x.doc_type,
    title: x.title,
    storageKey: x.storage_key,
    mimeType: x.mime_type,
    fileSize: x.file_size ?? undefined,
    issueDate: x.issue_date ?? undefined,
    expiryDate: x.expiry_date ?? undefined,
  }));

  return {
    batchId: Crypto.randomUUID(),
    deviceId: getDeviceIdSync(),
    appVersion: (Constants.expoConfig?.version as string) ?? '0.0.0',
    generatedAt: new Date().toISOString(),
    trips,
    drops,
    podPhotos,
    vehicleChecks,
    fuelEntries,
    trailSegments,
    documents,
  } as unknown as SyncBatch;
}

let _deviceId = 'pending';
void getDeviceId().then((id) => (_deviceId = id));
function getDeviceIdSync() {
  return _deviceId;
}

function isEmpty(b: SyncBatch): boolean {
  return (
    b.trips.length + b.drops.length + b.podPhotos.length + b.vehicleChecks.length +
      b.fuelEntries.length + b.trailSegments.length + b.documents.length ===
    0
  );
}

function markSyncing(b: SyncBatch) {
  const d = db();
  const set = (table: string, ids: string[]) => {
    if (!ids.length) return;
    const q = `UPDATE ${table} SET sync_state = 'syncing' WHERE client_id IN (${ids.map(() => '?').join(',')})`;
    d.runSync(q, ids);
  };
  set('trips', b.trips.map((x) => x.clientId));
  set('drops', b.drops.map((x) => x.clientId));
  set('pod_photos', b.podPhotos.map((x) => x.clientId));
  set('vehicle_checks', b.vehicleChecks.map((x) => x.clientId));
  set('fuel_entries', b.fuelEntries.map((x) => x.clientId));
  set('trail_segments', b.trailSegments.map((x) => x.clientId));
  set('documents', b.documents.map((x) => x.clientId));
}

function revertSyncing(b: SyncBatch) {
  db().execSync("UPDATE trips SET sync_state='dirty' WHERE sync_state='syncing'");
  db().execSync("UPDATE drops SET sync_state='dirty' WHERE sync_state='syncing'");
  db().execSync("UPDATE pod_photos SET sync_state='dirty' WHERE sync_state='syncing'");
  db().execSync("UPDATE vehicle_checks SET sync_state='dirty' WHERE sync_state='syncing'");
  db().execSync("UPDATE fuel_entries SET sync_state='dirty' WHERE sync_state='syncing'");
  db().execSync("UPDATE trail_segments SET sync_state='dirty' WHERE sync_state='syncing'");
  db().execSync("UPDATE documents SET sync_state='dirty' WHERE sync_state='syncing'");
}

function reconcile(result: import('@bv/core').dto.SyncResult) {
  const d = db();
  const tables = ['trips', 'drops', 'pod_photos', 'vehicle_checks', 'fuel_entries', 'trail_segments', 'documents'];
  for (const [clientId, serverId] of Object.entries(result.idMap)) {
    for (const table of tables) {
      d.runSync(
        `UPDATE ${table} SET server_id = ?, sync_state = 'synced' WHERE client_id = ? AND sync_state = 'syncing'`,
        [serverId, clientId],
      );
    }
  }
  for (const c of [...result.conflicts, ...result.rejected]) {
    for (const table of tables) {
      d.runSync(`UPDATE ${table} SET sync_state = 'conflict' WHERE client_id = ? AND sync_state = 'syncing'`, [c.clientId]);
    }
  }
  // anything still 'syncing' the server didn't mention → back to dirty for retry
  revertSyncing({ trips: [], drops: [], podPhotos: [], vehicleChecks: [], fuelEntries: [], trailSegments: [], documents: [] } as never);
}
