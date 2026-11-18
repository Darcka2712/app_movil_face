import type { Migration } from '../types';

export const migration001: Migration = {
  id: '001_init',
  sql: `CREATE TABLE IF NOT EXISTS schema_migrations (id TEXT PRIMARY KEY, applied_at TEXT NOT NULL);

CREATE TABLE IF NOT EXISTS attendance_events (
  event_id TEXT PRIMARY KEY,
  employee_id INTEGER,
  codigo TEXT,
  device_id TEXT NOT NULL,
  event_type TEXT NOT NULL CHECK (event_type IN ('ENTRY','EXIT')),
  occurred_at TEXT NOT NULL,
  sync_status TEXT NOT NULL DEFAULT 'PENDING',
  attempt_count INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_attendance_sync_status ON attendance_events(sync_status);
CREATE INDEX IF NOT EXISTS idx_attendance_occurred_at ON attendance_events(occurred_at);

CREATE TABLE IF NOT EXISTS sync_queue (
  event_id TEXT PRIMARY KEY REFERENCES attendance_events(event_id),
  next_attempt_at TEXT NOT NULL,
  locked_at TEXT,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sync_queue_next ON sync_queue(next_attempt_at);

CREATE TABLE IF NOT EXISTS employees_cache (
  id_empleado INTEGER PRIMARY KEY,
  codigo_empleado TEXT,
  nombre TEXT,
  apellido_paterno TEXT,
  apellido_materno TEXT,
  cached_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS device_config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);`,
};
