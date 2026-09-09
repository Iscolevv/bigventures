import { NextResponse } from 'next/server';
import { dto } from '@bv/core';
import { rowScope } from '@bv/core/rbac';
import { db, schema, eq, and, sql } from '@bv/db';
import { getMobileActor } from '@/lib/mobile-auth';
import { mapsEnabled, geocode, directions } from '@/lib/maps';

const { syncBatchSchema } = dto;

/**
 * POST /api/mobile/sync
 *
 * The driver app's offline queue drains here. Everything is upserted
 * idempotently by `client_uuid`, so a batch can be retried safely after a
 * flaky connection. Parents (trips) are written before children (drops, POD
 * photos); a child whose parent isn't found yet is reported as a conflict and
 * the app resends it in the next batch.
 *
 * Photos themselves are uploaded straight to R2 via presigned URLs; this batch
 * only carries their `storageKey`.
 */
export async function POST(req: Request) {
  const actor = await getMobileActor();
  if (!actor) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (rowScope('driver') !== 'own') {
    return NextResponse.json({ error: 'unexpected scope' }, { status: 500 });
  }

  const parsed = syncBatchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid batch', issues: parsed.error.issues }, { status: 400 });
  }
  const batch = parsed.data;

  // Idempotent at the batch level too.
  const existing = await db
    .select({ id: schema.syncBatches.id, status: schema.syncBatches.status, summary: schema.syncBatches.summary })
    .from(schema.syncBatches)
    .where(eq(schema.syncBatches.batch_id, batch.batchId))
    .limit(1);
  if (existing[0]) {
    return NextResponse.json({
      batchId: batch.batchId,
      status: existing[0].status,
      idMap: {},
      conflicts: [],
      rejected: [],
      replayed: true,
      serverTime: new Date().toISOString(),
    });
  }

  const idMap: Record<string, string> = {};
  const conflicts: Array<{ clientId: string; entity: string; reason: string }> = [];
  const rejected: Array<{ clientId: string; entity: string; reason: string }> = [];

  // --- vehicles this driver may write against (assigned, currently) ------
  const assigned = await db
    .select({ vehicleId: schema.vehicleAssignments.vehicle_id })
    .from(schema.vehicleAssignments)
    .where(
      and(
        eq(schema.vehicleAssignments.driver_id, actor.driverId),
        sql`${schema.vehicleAssignments.end_date} is null`,
      ),
    );
  const allowedVehicles = new Set(assigned.map((a) => a.vehicleId));
  const vehicleOk = (id: string) => allowedVehicles.size === 0 || allowedVehicles.has(id);

  // --- trips ----------------------------------------------------------
  for (const t of batch.trips) {
    if (!vehicleOk(t.vehicleId)) {
      rejected.push({ clientId: t.clientId, entity: 'trip', reason: 'vehicle not assigned to you' });
      continue;
    }
    try {
      const ref = await nextTripRef();
      const [row] = await db
        .insert(schema.trips)
        .values({
          reference_code: ref,
          vehicle_id: t.vehicleId,
          driver_id: actor.driverId,
          route_id: t.routeId,
          status: t.status,
          loading_point_address: t.loadingPointAddress,
          loading_lat: t.loading.lat,
          loading_lng: t.loading.lng,
          cargo_description: t.cargoDescription,
          client_ref: t.clientRef,
          started_at: t.startedAt ? new Date(t.startedAt) : null,
          ended_at: t.endedAt ? new Date(t.endedAt) : null,
          start_odometer_km: t.startOdometerKm != null ? String(t.startOdometerKm) : null,
          end_odometer_km: t.endOdometerKm != null ? String(t.endOdometerKm) : null,
          notes: t.notes,
          source: 'mobile',
          device_id: batch.deviceId,
          client_uuid: t.clientId,
          synced_at: new Date(),
        })
        .onConflictDoUpdate({
          target: schema.trips.client_uuid,
          set: {
            status: t.status,
            started_at: t.startedAt ? new Date(t.startedAt) : sql`${schema.trips.started_at}`,
            ended_at: t.endedAt ? new Date(t.endedAt) : sql`${schema.trips.ended_at}`,
            end_odometer_km: t.endOdometerKm != null ? String(t.endOdometerKm) : sql`${schema.trips.end_odometer_km}`,
            notes: t.notes,
            updated_at: new Date(),
            synced_at: new Date(),
          },
        })
        .returning({ id: schema.trips.id });
      if (row) idMap[t.clientId] = row.id;
    } catch (e) {
      rejected.push({ clientId: t.clientId, entity: 'trip', reason: errMsg(e) });
    }
  }

  const tripId = (clientId: string) => idMap[clientId];

  // --- vehicle checks -----------------------------------------------
  for (const c of batch.vehicleChecks) {
    const trip = tripId(c.tripClientId);
    if (!trip) {
      conflicts.push({ clientId: c.clientId, entity: 'vehicle_check', reason: 'parent trip not synced yet' });
      continue;
    }
    try {
      const [row] = await db
        .insert(schema.vehicleChecks)
        .values({
          trip_id: trip,
          vehicle_id: c.vehicleId,
          driver_id: actor.driverId,
          performed_at: new Date(c.performedAt),
          overall_result: c.overallResult,
          odometer_km: c.odometerKm != null ? String(c.odometerKm) : null,
          notes: c.notes,
          client_uuid: c.clientId,
        })
        .onConflictDoUpdate({
          target: schema.vehicleChecks.client_uuid,
          set: { overall_result: c.overallResult, notes: c.notes, updated_at: new Date() },
        })
        .returning({ id: schema.vehicleChecks.id });
      if (row) {
        idMap[c.clientId] = row.id;
        if (c.items.length) {
          await db
            .insert(schema.vehicleCheckItems)
            .values(
              c.items.map((it) => ({
                check_id: row.id,
                item_key: it.key,
                result: it.result,
                value: it.value,
                photo_key: it.photoKey,
                notes: it.notes,
              })),
            )
            .onConflictDoNothing();
        }
      }
    } catch (e) {
      rejected.push({ clientId: c.clientId, entity: 'vehicle_check', reason: errMsg(e) });
    }
  }

  // --- fuel entries ------------------------------------------------
  for (const f of batch.fuelEntries) {
    try {
      const [row] = await db
        .insert(schema.fuelEntries)
        .values({
          vehicle_id: f.vehicleId,
          driver_id: actor.driverId,
          trip_id: f.tripClientId ? tripId(f.tripClientId) : null,
          litres: String(f.litres),
          unit_price: f.unitPrice != null ? String(f.unitPrice) : null,
          total_cost: String(f.totalCost),
          odometer_km: String(f.odometerKm),
          station: f.station,
          receipt_photo_key: f.receiptPhotoKey,
          filled_at: new Date(f.filledAt),
          source: 'mobile',
          client_uuid: f.clientId,
          notes: f.notes,
        })
        .onConflictDoUpdate({
          target: schema.fuelEntries.client_uuid,
          set: { total_cost: String(f.totalCost), odometer_km: String(f.odometerKm), updated_at: new Date() },
        })
        .returning({ id: schema.fuelEntries.id });
      if (row) idMap[f.clientId] = row.id;
    } catch (e) {
      rejected.push({ clientId: f.clientId, entity: 'fuel_entry', reason: errMsg(e) });
    }
  }

  // --- drops ------------------------------------------------------
  for (const d of batch.drops) {
    const trip = tripId(d.tripClientId);
    if (!trip) {
      conflicts.push({ clientId: d.clientId, entity: 'drop', reason: 'parent trip not synced yet' });
      continue;
    }
    try {
      const [row] = await db
        .insert(schema.drops)
        .values({
          trip_id: trip,
          sequence: d.sequence,
          destination_address: d.destinationAddress,
          dest_lat: d.destination.lat,
          dest_lng: d.destination.lng,
          status: d.status,
          signee_name: d.signeeName,
          issue_category: d.issueCategory,
          issue_notes: d.issueNotes,
          notes: d.notes,
          arrived_at: d.arrivedAt ? new Date(d.arrivedAt) : null,
          completed_at: d.completedAt ? new Date(d.completedAt) : null,
          geofence_entered_at: d.geofenceEnteredAt ? new Date(d.geofenceEnteredAt) : null,
          geofence_skipped: !d.geofenceEnteredAt && d.status !== 'pending' && d.status !== 'arrived',
          client_uuid: d.clientId,
        })
        .onConflictDoUpdate({
          target: schema.drops.client_uuid,
          set: {
            status: d.status,
            signee_name: d.signeeName,
            issue_category: d.issueCategory,
            issue_notes: d.issueNotes,
            arrived_at: d.arrivedAt ? new Date(d.arrivedAt) : sql`${schema.drops.arrived_at}`,
            completed_at: d.completedAt ? new Date(d.completedAt) : sql`${schema.drops.completed_at}`,
            updated_at: new Date(),
          },
        })
        .returning({ id: schema.drops.id });
      if (row) idMap[d.clientId] = row.id;
    } catch (e) {
      rejected.push({ clientId: d.clientId, entity: 'drop', reason: errMsg(e) });
    }
  }

  // --- POD photos -----------------------------------------------
  for (const p of batch.podPhotos) {
    const drop = idMap[p.dropClientId];
    if (!drop) {
      conflicts.push({ clientId: p.clientId, entity: 'pod_photo', reason: 'parent drop not synced yet' });
      continue;
    }
    try {
      const [row] = await db
        .insert(schema.podPhotos)
        .values({
          drop_id: drop,
          storage_key: p.storageKey,
          captured_lat: p.captured?.lat,
          captured_lng: p.captured?.lng,
          captured_at: new Date(p.capturedAt),
          sha256: p.sha256,
          file_size: p.fileSize,
          source: 'camera',
          client_uuid: p.clientId,
        })
        .onConflictDoNothing({ target: schema.podPhotos.client_uuid })
        .returning({ id: schema.podPhotos.id });
      if (row) idMap[p.clientId] = row.id;
      else {
        const existing = await db
          .select({ id: schema.podPhotos.id })
          .from(schema.podPhotos)
          .where(eq(schema.podPhotos.client_uuid, p.clientId))
          .limit(1);
        if (existing[0]) idMap[p.clientId] = existing[0].id;
      }
    } catch (e) {
      rejected.push({ clientId: p.clientId, entity: 'pod_photo', reason: errMsg(e) });
    }
  }

  // --- trail segments -----------------------------------------
  for (const seg of batch.trailSegments) {
    const trip = tripId(seg.tripClientId);
    if (!trip) {
      conflicts.push({ clientId: seg.clientId, entity: 'trail_segment', reason: 'parent trip not synced yet' });
      continue;
    }
    try {
      const times = seg.points.map((pt) => pt.t).sort((a, b) => a - b);
      await db
        .insert(schema.trailSegments)
        .values({
          trip_id: trip,
          points: seg.points,
          point_count: seg.points.length,
          started_at: times[0] ? new Date(times[0]) : null,
          ended_at: times.at(-1) ? new Date(times.at(-1)!) : null,
          client_uuid: seg.clientId,
        })
        .onConflictDoNothing({ target: schema.trailSegments.client_uuid });
      idMap[seg.clientId] = seg.clientId;
    } catch (e) {
      rejected.push({ clientId: seg.clientId, entity: 'trail_segment', reason: errMsg(e) });
    }
  }

  // --- documents (driver's own compliance uploads) ----------
  for (const doc of batch.documents) {
    try {
      const [row] = await db
        .insert(schema.documents)
        .values({
          owner_type: 'driver',
          owner_id: actor.driverId,
          doc_type: doc.docType as never,
          title: doc.title,
          storage_key: doc.storageKey,
          mime_type: doc.mimeType,
          file_size: doc.fileSize,
          issue_date: doc.issueDate ? doc.issueDate.slice(0, 10) : null,
          expiry_date: doc.expiryDate ? doc.expiryDate.slice(0, 10) : null,
          status: 'pending_review',
          uploaded_by: actor.userId,
          uploaded_by_role: 'driver',
        })
        .returning({ id: schema.documents.id });
      if (row) idMap[doc.clientId] = row.id;
    } catch (e) {
      rejected.push({ clientId: doc.clientId, entity: 'document', reason: errMsg(e) });
    }
  }

  // --- enrich new trips with a planned route (Google Directions) ------
  // No-ops entirely when GOOGLE_MAPS_SERVER_KEY is unset.
  if (mapsEnabled()) {
    for (const t of batch.trips) {
      const serverId = idMap[t.clientId];
      if (!serverId) continue;
      try {
        await enrichTripRoute(serverId);
      } catch {
        /* best effort — a trip without a planned route still works */
      }
    }
  }

  const status = rejected.length
    ? conflicts.length || Object.keys(idMap).length
      ? 'partial'
      : 'rejected'
    : conflicts.length
      ? 'partial'
      : 'accepted';

  await db.insert(schema.syncBatches).values({
    batch_id: batch.batchId,
    device_id: batch.deviceId,
    driver_id: actor.driverId,
    app_version: batch.appVersion,
    status,
    summary: {
      trips: batch.trips.length,
      drops: batch.drops.length,
      podPhotos: batch.podPhotos.length,
      vehicleChecks: batch.vehicleChecks.length,
      fuelEntries: batch.fuelEntries.length,
      trailSegments: batch.trailSegments.length,
      documents: batch.documents.length,
      accepted: Object.keys(idMap).length,
    },
    conflicts,
    rejected,
  });

  return NextResponse.json({
    batchId: batch.batchId,
    status,
    idMap,
    conflicts,
    rejected,
    serverTime: new Date().toISOString(),
  });
}

/**
 * Fill in a trip's loading coordinates (geocode if the driver didn't pin),
 * geocode any drop that came in address-only, then call Directions for the
 * planned polyline + distance + duration, and update the trip + drops.
 */
async function enrichTripRoute(tripServerId: string) {
  const [trip] = await db
    .select({
      id: schema.trips.id,
      loadingAddr: schema.trips.loading_point_address,
      lat: schema.trips.loading_lat,
      lng: schema.trips.loading_lng,
      polyline: schema.trips.planned_polyline,
    })
    .from(schema.trips)
    .where(eq(schema.trips.id, tripServerId))
    .limit(1);
  if (!trip || trip.polyline) return; // already has a route

  let origin = trip.lat != null && trip.lng != null ? { lat: trip.lat, lng: trip.lng } : null;
  if (!origin && trip.loadingAddr) {
    const g = await geocode(trip.loadingAddr);
    if (g) {
      origin = { lat: g.lat, lng: g.lng };
      await db
        .update(schema.trips)
        .set({ loading_lat: g.lat, loading_lng: g.lng })
        .where(eq(schema.trips.id, tripServerId));
    }
  }
  if (!origin) return;

  const dropRows = await db
    .select({
      id: schema.drops.id,
      seq: schema.drops.sequence,
      addr: schema.drops.destination_address,
      lat: schema.drops.dest_lat,
      lng: schema.drops.dest_lng,
    })
    .from(schema.drops)
    .where(eq(schema.drops.trip_id, tripServerId))
    .orderBy(schema.drops.sequence);
  if (dropRows.length === 0) return;

  const points: { lat: number; lng: number }[] = [];
  for (const d of dropRows) {
    if (d.lat != null && d.lng != null) {
      points.push({ lat: d.lat, lng: d.lng });
    } else {
      const g = await geocode(d.addr);
      if (g) {
        points.push({ lat: g.lat, lng: g.lng });
        await db
          .update(schema.drops)
          .set({ dest_lat: g.lat, dest_lng: g.lng })
          .where(eq(schema.drops.id, d.id));
      }
    }
  }
  if (points.length === 0) return;

  const destination = points[points.length - 1]!;
  const waypoints = points.slice(0, -1);
  const route = await directions(origin, destination, waypoints);
  if (!route) return;

  await db
    .update(schema.trips)
    .set({
      planned_polyline: route.polyline,
      planned_distance_m: route.distanceM,
      planned_duration_s: route.durationS,
    })
    .where(eq(schema.trips.id, tripServerId));
}

async function nextTripRef(): Promise<string> {
  const year = new Date().getUTCFullYear();
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(schema.trips)
    .where(sql`${schema.trips.reference_code} like ${'TRP-' + year + '-%'}`);
  const seq = (row?.n ?? 0) + 1;
  return `TRP-${year}-${String(seq).padStart(6, '0')}`;
}

function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}
