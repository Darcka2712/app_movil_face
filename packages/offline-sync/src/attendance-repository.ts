import type { Database } from '@face/database';
import type { SyncStatus } from '@face/shared-types';
import type { AttendanceEvent, AttendanceRepository } from './types';

interface AttendanceRow {
  event_id: string;
  employee_id: number | null;
  codigo: string | null;
  device_id: string;
  event_type: 'ENTRY' | 'EXIT';
  occurred_at: string;
  sync_status: SyncStatus;
  attempt_count: number;
  last_error?: string;
}

function toEvent(row: AttendanceRow): AttendanceEvent {
  return {
    eventId: row.event_id,
    employeeId: row.employee_id,
    codigo: row.codigo,
    deviceId: row.device_id,
    eventType: row.event_type,
    occurredAt: row.occurred_at,
    syncStatus: row.sync_status,
    attemptCount: row.attempt_count,
    ...(row.last_error !== undefined && row.last_error !== null
      ? { lastError: row.last_error }
      : {}),
  };
}

export function createAttendanceRepository(db: Database): AttendanceRepository {
  return {
    async insert(event: AttendanceEvent): Promise<void> {
      await db.insert('attendance_events', {
        event_id: event.eventId,
        employee_id: event.employeeId,
        codigo: event.codigo,
        device_id: event.deviceId,
        event_type: event.eventType,
        occurred_at: event.occurredAt,
        sync_status: event.syncStatus,
        attempt_count: event.attemptCount,
        last_error: event.lastError ?? null,
        created_at: new Date().toISOString(),
      });
    },

    async getByEventId(eventId: string): Promise<AttendanceEvent | null> {
      const rows = await db.select<AttendanceRow>('attendance_events', { event_id: eventId });
      const row = rows[0];
      return row ? toEvent(row) : null;
    },

    async listByStatus(status: SyncStatus, limit: number): Promise<AttendanceEvent[]> {
      const rows = await db.select<AttendanceRow>('attendance_events', { sync_status: status });
      return rows.slice(0, limit).map(toEvent);
    },

    async updateStatus(
      eventId: string,
      status: SyncStatus,
      patch?: { attemptCount?: number; lastError?: string },
    ): Promise<void> {
      const updates: Record<string, unknown> = { sync_status: status };
      if (patch?.attemptCount !== undefined) updates.attempt_count = patch.attemptCount;
      if (patch?.lastError !== undefined) updates.last_error = patch.lastError;
      await db.update('attendance_events', { event_id: eventId }, updates);
    },

    async countByStatus(status: SyncStatus): Promise<number> {
      const rows = await db.select('attendance_events', { sync_status: status });
      return rows.length;
    },
  };
}
