'use server';
import { revalidatePath } from 'next/cache';
import { randomUUID } from 'node:crypto';
import { getDriver } from '@/lib/driver-session';
import { db, schema, eq, and, sql } from '@bv/db';
import { DRIVER_MUTABLE_TRIP_STATUSES } from '@bv/core/rbac';
import { BLOCKING_CHECK_KEYS, DOCUMENT_TYPE_BY_KEY } from '@bv/core/reference';
import { buildKey, uploadObject, storageConfigured } from '@/lib/storage';
import { mapsEnabled, geocode } from '@/lib/maps';

const OK_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'application/pdf']);

async function ownTrip(driverId: string, tripId: string) {
  const [t] = await db.select().from(schema.trips).where(eq(schema.trips.id, tripId)).limit(1);
  if (!t || t.driver_id !== driverId) throw new Error('not your trip');
  return t;
}
async function ownDrop(driverId: string, dropId: string) {
  const [d] = await db
    .select({ drop: schema.drops, tripDriver: schema.trips.driver_id, tripId: schema.trips.id })
    .from(schema.drops)
    .innerJoin(schema.trips, eq(schema.trips.id, schema.drops.trip_id))
    .where(eq(schema.drops.id, dropId))
    .limit(1);
  if (!d || d.tripDriver !== driverId) throw new Error('not your drop');
  return d;
}

async function nextTripRef() {
  const year = new Date().getUTCFullYear();
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(schema.trips)
    .where(sql`${schema.trips.reference_code} like ${'TRP-' + year + '-%'}`);
  return `TRP-${year}-${String((row?.n ?? 0) + 1).padStart(6, '0')}`;
}

export async function createTrip(form: FormData) {
  const me = await getDriver();
  const vehicleId = String(form.get('vehicleId') ?? '');
  const loadingAddress = String(form.get('loadingAddress') ?? '').trim();
  const cargo = String(form.get('cargo') ?? '').trim();
  const lat = form.get('lat') ? Number(form.get('lat')) : null;
  const lng = form.get('lng') ? Number(form.get('lng')) : null;
  if (!vehicleId || !loadingAddress) return { error: 'Vehicle and loading point are required' };

  // must be assigned to this vehicle
  const assigned = await db
    .select({ id: schema.vehicleAssignments.id })
    .from(schema.vehicleAssignments)
    .where(
      and(
        eq(schema.vehicleAssignments.driver_id, me.driverId),
        eq(schema.vehicleAssignments.vehicle_id, vehicleId),
        sql`${schema.vehicleAssignments.end_date} is null`,
      ),
    )
    .limit(1);
  if (!assigned[0]) return { error: 'That vehicle is not assigned to you' };

  let loadLat = lat;
  let loadLng = lng;
  if ((loadLat == null || loadLng == null) && mapsEnabled()) {
    const g = await geocode(loadingAddress);
    if (g) {
      loadLat = g.lat;
      loadLng = g.lng;
    }
  }

  const id = randomUUID();
  await db.insert(schema.trips).values({
    id,
    reference_code: await nextTripRef(),
    vehicle_id: vehicleId,
    driver_id: me.driverId,
    status: 'draft',
    loading_point_address: loadingAddress,
    loading_lat: loadLat,
    loading_lng: loadLng,
    cargo_description: cargo || null,
    source: 'dashboard',
    created_by: me.userId,
  });
  revalidatePath('/d');
  return { ok: true, id };
}

export async function addDrop(form: FormData) {
  const me = await getDriver();
  const tripId = String(form.get('tripId') ?? '');
  const address = String(form.get('address') ?? '').trim();
  const lat = form.get('lat') ? Number(form.get('lat')) : null;
  const lng = form.get('lng') ? Number(form.get('lng')) : null;
  const trip = await ownTrip(me.driverId, tripId);
  if (trip.status === 'completed' || trip.status === 'cancelled') return { error: 'Trip is closed' };
  if (!address) return { error: 'Address required' };

  const [{ n } = { n: 0 }] = await db
    .select({ n: sql<number>`coalesce(max(${schema.drops.sequence}),0)::int` })
    .from(schema.drops)
    .where(eq(schema.drops.trip_id, tripId));

  let dLat = lat;
  let dLng = lng;
  if ((dLat == null || dLng == null) && mapsEnabled()) {
    const g = await geocode(address);
    if (g) {
      dLat = g.lat;
      dLng = g.lng;
    }
  }
  await db.insert(schema.drops).values({
    trip_id: tripId,
    sequence: n + 1,
    destination_address: address,
    dest_lat: dLat,
    dest_lng: dLng,
    status: 'pending',
  });
  revalidatePath(`/d/t/${tripId}`);
  return { ok: true };
}

export async function submitVehicleCheck(form: FormData) {
  const me = await getDriver();
  const tripId = String(form.get('tripId') ?? '');
  const odometer = form.get('odometer') ? Number(form.get('odometer')) : null;
  const items = JSON.parse(String(form.get('items') ?? '[]')) as {
    key: string;
    result: 'pass' | 'fail' | 'na';
    value?: string;
    notes?: string;
  }[];
  const trip = await ownTrip(me.driverId, tripId);

  const blockingFail = items.some((i) => BLOCKING_CHECK_KEYS.has(i.key) && i.result === 'fail');
  const anyFail = items.some((i) => i.result === 'fail');
  const overall = blockingFail ? 'fail' : anyFail ? 'flagged' : 'pass';

  const checkId = randomUUID();
  await db.insert(schema.vehicleChecks).values({
    id: checkId,
    trip_id: tripId,
    vehicle_id: trip.vehicle_id,
    driver_id: me.driverId,
    performed_at: new Date(),
    overall_result: overall,
    odometer_km: odometer != null ? String(odometer) : null,
  });
  if (items.length) {
    await db
      .insert(schema.vehicleCheckItems)
      .values(
        items.map((i) => ({
          check_id: checkId,
          item_key: i.key,
          result: i.result,
          value: i.value || null,
          notes: i.notes || null,
        })),
      )
      .onConflictDoNothing();
  }
  await db
    .update(schema.trips)
    .set({
      status: 'pre_check',
      start_odometer_km: odometer != null ? String(odometer) : trip.start_odometer_km,
      updated_at: new Date(),
    })
    .where(eq(schema.trips.id, tripId));
  revalidatePath(`/d/t/${tripId}`);
  return { ok: true as const, overall, error: undefined as string | undefined };
}

export async function startTrip(tripId: string) {
  const me = await getDriver();
  const trip = await ownTrip(me.driverId, tripId);
  const dropCount = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(schema.drops)
    .where(eq(schema.drops.trip_id, tripId));
  const checkCount = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(schema.vehicleChecks)
    .where(eq(schema.vehicleChecks.trip_id, tripId));
  if ((dropCount[0]?.n ?? 0) === 0) return { error: 'Add at least one drop first' };
  if ((checkCount[0]?.n ?? 0) === 0) return { error: 'Complete the vehicle check first' };
  if (!DRIVER_MUTABLE_TRIP_STATUSES.includes(trip.status as 'draft')) {
    return { error: `Trip is ${trip.status}` };
  }
  await db
    .update(schema.trips)
    .set({ status: 'in_progress', started_at: sql`coalesce(${schema.trips.started_at}, now())`, updated_at: new Date() })
    .where(eq(schema.trips.id, tripId));
  revalidatePath(`/d/t/${tripId}`);
  return { ok: true };
}

export async function closeTrip(form: FormData) {
  const me = await getDriver();
  const tripId = String(form.get('tripId') ?? '');
  const endOdo = form.get('endOdometer') ? Number(form.get('endOdometer')) : null;
  await ownTrip(me.driverId, tripId);
  const open = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(schema.drops)
    .where(and(eq(schema.drops.trip_id, tripId), sql`${schema.drops.status} in ('pending','arrived')`));
  if ((open[0]?.n ?? 0) > 0) return { error: 'Close every drop before finishing the trip' };
  await db
    .update(schema.trips)
    .set({
      status: 'completed',
      ended_at: sql`coalesce(${schema.trips.ended_at}, now())`,
      end_odometer_km: endOdo != null ? String(endOdo) : schema.trips.end_odometer_km,
      updated_at: new Date(),
    })
    .where(eq(schema.trips.id, tripId));
  revalidatePath(`/d/t/${tripId}`);
  revalidatePath('/d');
  return { ok: true };
}

export async function arriveDrop(dropId: string, lat?: number, lng?: number) {
  const me = await getDriver();
  const { drop } = await ownDrop(me.driverId, dropId);
  if (drop.status !== 'pending') return { ok: true };
  await db
    .update(schema.drops)
    .set({
      status: 'arrived',
      arrived_at: sql`coalesce(${schema.drops.arrived_at}, now())`,
      geofence_entered_at: lat != null ? sql`coalesce(${schema.drops.geofence_entered_at}, now())` : schema.drops.geofence_entered_at,
      updated_at: new Date(),
    })
    .where(eq(schema.drops.id, dropId));
  revalidatePath(`/d/drop/${dropId}`);
  return { ok: true };
}

export async function completeDrop(form: FormData) {
  const me = await getDriver();
  const dropId = String(form.get('dropId') ?? '');
  const status = String(form.get('status') ?? '') as 'delivered' | 'partial' | 'failed' | 'returned';
  const signee = String(form.get('signee') ?? '').trim();
  const issue = String(form.get('issue') ?? '').trim();
  const issueNotes = String(form.get('issueNotes') ?? '').trim();
  const { drop, tripId } = await ownDrop(me.driverId, dropId);

  if ((status === 'delivered' || status === 'partial')) {
    const photos = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(schema.podPhotos)
      .where(eq(schema.podPhotos.drop_id, dropId));
    if ((photos[0]?.n ?? 0) === 0) return { error: 'Take at least one proof-of-delivery photo first' };
  }
  if ((status === 'partial' || status === 'failed' || status === 'returned') && !issue) {
    return { error: 'Pick what went wrong' };
  }
  await db
    .update(schema.drops)
    .set({
      status,
      signee_name: signee || null,
      issue_category: (issue || null) as 'damage' | null,
      issue_notes: issueNotes || null,
      completed_at: sql`coalesce(${schema.drops.completed_at}, now())`,
      geofence_skipped: !drop.geofence_entered_at,
      updated_at: new Date(),
    })
    .where(eq(schema.drops.id, dropId));
  revalidatePath(`/d/t/${tripId}`);
  return { ok: true };
}

export async function uploadPod(form: FormData) {
  const me = await getDriver();
  const dropId = String(form.get('dropId') ?? '');
  const file = form.get('file');
  const lat = form.get('lat') ? Number(form.get('lat')) : null;
  const lng = form.get('lng') ? Number(form.get('lng')) : null;
  await ownDrop(me.driverId, dropId);
  if (!storageConfigured()) return { error: 'File storage not set up yet' };
  if (!(file instanceof File)) return { error: 'No photo' };
  if (file.size > 10 * 1024 * 1024) return { error: 'Photo too large' };
  if (!file.type.startsWith('image/')) return { error: 'Not an image' };

  const key = buildKey('pod', me.driverId, file.name || 'pod.jpg');
  const stored = await uploadObject(key, file.type, await file.arrayBuffer());
  await db.insert(schema.podPhotos).values({
    drop_id: dropId,
    storage_key: stored.url.startsWith('http') ? stored.url : stored.key,
    captured_lat: lat,
    captured_lng: lng,
    captured_at: new Date(),
    mime_type: file.type,
    file_size: file.size,
    source: 'camera',
  });
  revalidatePath(`/d/drop/${dropId}`);
  return { ok: true };
}

export async function addFuel(form: FormData) {
  const me = await getDriver();
  const tripId = String(form.get('tripId') ?? '');
  const litres = Number(form.get('litres'));
  const total = Number(form.get('total'));
  const unitPrice = form.get('unitPrice') ? Number(form.get('unitPrice')) : null;
  const odometer = Number(form.get('odometer'));
  const station = String(form.get('station') ?? '').trim();
  const receipt = form.get('receipt');
  const trip = await ownTrip(me.driverId, tripId);
  if (!litres || !total || !odometer) return { error: 'Litres, total and odometer are required' };

  let receiptKey: string | null = null;
  if (receipt instanceof File && receipt.size > 0 && storageConfigured()) {
    const key = buildKey('receipt', me.driverId, receipt.name || 'receipt.jpg');
    const stored = await uploadObject(key, receipt.type, await receipt.arrayBuffer());
    receiptKey = stored.url.startsWith('http') ? stored.url : stored.key;
  }
  await db.insert(schema.fuelEntries).values({
    vehicle_id: trip.vehicle_id,
    driver_id: me.driverId,
    trip_id: tripId,
    litres: String(litres),
    unit_price: unitPrice != null ? String(unitPrice) : null,
    total_cost: String(total),
    odometer_km: String(odometer),
    station: station || null,
    receipt_photo_key: receiptKey,
    filled_at: new Date(),
    source: 'dashboard',
    created_by: me.userId,
  });
  revalidatePath(`/d/t/${tripId}`);
  return { ok: true };
}

export async function uploadDriverDoc(form: FormData) {
  const me = await getDriver();
  const docType = String(form.get('docType') ?? '');
  const file = form.get('file');
  const issueDate = form.get('issueDate') ? String(form.get('issueDate')) : null;
  const expiryDate = form.get('expiryDate') ? String(form.get('expiryDate')) : null;
  const def = DOCUMENT_TYPE_BY_KEY[docType as keyof typeof DOCUMENT_TYPE_BY_KEY];
  if (!def || def.owner !== 'driver') return { error: 'Unknown document type' };
  if (!storageConfigured()) return { error: 'File storage not set up yet' };
  if (!(file instanceof File)) return { error: 'No file' };
  if (file.size > 10 * 1024 * 1024) return { error: 'File too large' };
  if (!OK_TYPES.has(file.type)) return { error: `Unsupported type ${file.type}` };

  const key = buildKey('document', me.driverId, file.name);
  const stored = await uploadObject(key, file.type, await file.arrayBuffer());
  await db.insert(schema.documents).values({
    owner_type: 'driver',
    owner_id: me.driverId,
    doc_type: docType as 'drivers_license',
    title: `${me.name} — ${def.label}`,
    storage_key: stored.url.startsWith('http') ? stored.url : stored.key,
    mime_type: file.type,
    file_size: file.size,
    issue_date: issueDate,
    expiry_date: expiryDate,
    status: 'pending_review',
    uploaded_by: me.userId,
    uploaded_by_role: 'driver',
  });
  revalidatePath('/d/docs');
  return { ok: true };
}

export async function pingTrail(tripId: string, points: { lat: number; lng: number; t: number }[]) {
  const me = await getDriver();
  const trip = await ownTrip(me.driverId, tripId);
  if (trip.status !== 'in_progress' || points.length === 0) return { ok: true };
  const times = points.map((p) => p.t).sort((a, b) => a - b);
  await db.insert(schema.trailSegments).values({
    trip_id: tripId,
    points,
    point_count: points.length,
    started_at: new Date(times[0]!),
    ended_at: new Date(times.at(-1)!),
  });
  // opportunistically mark arrival at any pending drop we're sitting on
  const last = points.at(-1)!;
  const pending = await db
    .select({ id: schema.drops.id, lat: schema.drops.dest_lat, lng: schema.drops.dest_lng, radius: schema.drops.geofence_radius_m })
    .from(schema.drops)
    .where(and(eq(schema.drops.trip_id, tripId), eq(schema.drops.status, 'pending')));
  for (const d of pending) {
    if (d.lat == null || d.lng == null) continue;
    const dm = haversine(last, { lat: d.lat, lng: d.lng });
    if (dm <= (d.radius ?? 120)) {
      await db
        .update(schema.drops)
        .set({ status: 'arrived', arrived_at: sql`coalesce(${schema.drops.arrived_at}, now())`, geofence_entered_at: sql`coalesce(${schema.drops.geofence_entered_at}, now())` })
        .where(eq(schema.drops.id, d.id));
    }
  }
  return { ok: true };
}

function haversine(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6_371_000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
}
