import type { SyncStatus } from '@face/shared-types';

export interface AttendanceEvent {
  eventId: string;
  employeeId: number | null;
  codigo: string | null;
  deviceId: string;
  eventType: 'ENTRY' | 'EXIT';
  occurredAt: string;
  syncStatus: SyncStatus;
  attemptCount: number;
  lastError?: string;
}

export interface AttendanceRepository {
  insert(event: AttendanceEvent): Promise<void>;
  getByEventId(eventId: string): Promise<AttendanceEvent | null>;
  listByStatus(status: SyncStatus, limit: number): Promise<AttendanceEvent[]>;
  updateStatus(
    eventId: string,
    status: SyncStatus,
    patch?: { attemptCount?: number; lastError?: string },
  ): Promise<void>;
  countByStatus(status: SyncStatus): Promise<number>;
}

export interface SyncQueueItem {
  eventId: string;
  nextAttemptAt: string;
  lockedAt: string | null;
}

export interface SyncQueue {
  enqueue(eventId: string, nextAttemptAt: string): Promise<void>;
  claimDue(nowIso: string, limit: number): Promise<SyncQueueItem[]>;
  reschedule(eventId: string, nextAttemptAt: string): Promise<void>;
  release(eventId: string): Promise<void>;
  remove(eventId: string): Promise<void>;
}
