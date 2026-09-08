/**
 * Local SQLite store. The app is offline-first: every screen reads and writes
 * here, never the network. A background sync loop (sync.ts) reconciles with the
 * server and rewrites `server_id` / `sync_state` in place.
 *
 * `sync_state`: 'dirty'  — created/edited locally, needs pushing
 *               'syncing' — included in an in-flight batch
 *               'synced'  — server has it, server_id known
 *               'conflict'— server rejected or diverged; show in a review screen
 */
import * as SQLite from 'expo-sqlite';

let _db: SQLite.SQLiteDatabase | null = null;

export function db(): SQLite.SQLiteDatabase {
  if (!_db) {
    _db = SQLite.openDatabaseSync('bigventures.db');
    _db.execSync('PRAGMA journal_mode = WAL;');
  }
  return _db;
}

export function migrate(): void {
  db().execSync(`
    CREATE TABLE IF NOT EXISTS trips (
      client_id TEXT PRIMARY KEY,
      server_id TEXT,
      reference_code TEXT,
      vehicle_id TEXT NOT NULL,
      route_id TEXT,
      status TEXT NOT NULL,
      loading_address TEXT NOT NULL,
      loading_lat REAL, loading_lng REAL,
      planned_polyline TEXT,
      planned_distance_m INTEGER,
      cargo_description TEXT,
      client_ref TEXT,
      start_odometer_km REAL,
      end_odometer_km REAL,
      started_at TEXT, ended_at TEXT,
      notes TEXT,
      sync_state TEXT NOT NULL DEFAULT 'dirty',
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS drops (
      client_id TEXT PRIMARY KEY,
      server_id TEXT,
      trip_client_id TEXT NOT NULL,
      sequence INTEGER NOT NULL,
      destination_address TEXT NOT NULL,
      dest_lat REAL, dest_lng REAL,
      geofence_radius_m INTEGER NOT NULL DEFAULT 120,
      status TEXT NOT NULL DEFAULT 'pending',
      signee_name TEXT,
      issue_category TEXT,
      issue_notes TEXT,
      notes TEXT,
      arrived_at TEXT, completed_at TEXT, geofence_entered_at TEXT,
      sync_state TEXT NOT NULL DEFAULT 'dirty',
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS pod_photos (
      client_id TEXT PRIMARY KEY,
      server_id TEXT,
      drop_client_id TEXT NOT NULL,
      local_uri TEXT NOT NULL,
      storage_key TEXT,
      captured_at TEXT NOT NULL,
      captured_lat REAL, captured_lng REAL,
      sha256 TEXT,
      file_size INTEGER,
      upload_state TEXT NOT NULL DEFAULT 'pending',
      sync_state TEXT NOT NULL DEFAULT 'dirty'
    );

    CREATE TABLE IF NOT EXISTS vehicle_checks (
      client_id TEXT PRIMARY KEY,
      server_id TEXT,
      trip_client_id TEXT NOT NULL,
      vehicle_id TEXT NOT NULL,
      performed_at TEXT NOT NULL,
      overall_result TEXT NOT NULL,
      odometer_km REAL,
      notes TEXT,
      items_json TEXT NOT NULL DEFAULT '[]',
      sync_state TEXT NOT NULL DEFAULT 'dirty'
    );

    CREATE TABLE IF NOT EXISTS fuel_entries (
      client_id TEXT PRIMARY KEY,
      server_id TEXT,
      vehicle_id TEXT NOT NULL,
      trip_client_id TEXT,
      litres REAL NOT NULL,
      unit_price REAL,
      total_cost REAL NOT NULL,
      odometer_km REAL NOT NULL,
      station TEXT,
      receipt_local_uri TEXT,
      receipt_storage_key TEXT,
      filled_at TEXT NOT NULL,
      notes TEXT,
      sync_state TEXT NOT NULL DEFAULT 'dirty'
    );

    CREATE TABLE IF NOT EXISTS trail_segments (
      client_id TEXT PRIMARY KEY,
      trip_client_id TEXT NOT NULL,
      points_json TEXT NOT NULL,
      sync_state TEXT NOT NULL DEFAULT 'dirty'
    );

    CREATE TABLE IF NOT EXISTS documents (
      client_id TEXT PRIMARY KEY,
      server_id TEXT,
      doc_type TEXT NOT NULL,
      title TEXT NOT NULL,
      local_uri TEXT NOT NULL,
      storage_key TEXT,
      mime_type TEXT NOT NULL,
      file_size INTEGER,
      issue_date TEXT, expiry_date TEXT,
      upload_state TEXT NOT NULL DEFAULT 'pending',
      sync_state TEXT NOT NULL DEFAULT 'dirty'
    );

    CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT);
  `);
}

export function getMeta(key: string): string | null {
  const row = db().getFirstSync<{ value: string }>('SELECT value FROM meta WHERE key = ?', [key]);
  return row?.value ?? null;
}

export function setMeta(key: string, value: string): void {
  db().runSync(
    'INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
    [key, value],
  );
}
