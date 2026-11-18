import type { Database } from '@face/database';
import type { SyncQueue, SyncQueueItem } from './types';

interface QueueRow {
  event_id: string;
  next_attempt_at: string;
  locked_at: string | null;
}

function toItem(row: QueueRow, lockedAtOverride?: string | null): SyncQueueItem {
  return {
    eventId: row.event_id,
    nextAttemptAt: row.next_attempt_at,
    lockedAt: lockedAtOverride !== undefined ? lockedAtOverride : (row.locked_at ?? null),
  };
}

export function createSyncQueue(db: Database): SyncQueue {
  return {
    async enqueue(eventId: string, nextAttemptAt: string): Promise<void> {
      await db.insert('sync_queue', {
        event_id: eventId,
        next_attempt_at: nextAttemptAt,
        locked_at: null,
        updated_at: new Date().toISOString(),
      });
    },

    async claimDue(nowIso: string, limit: number): Promise<SyncQueueItem[]> {
      const rows = await db.select<QueueRow>('sync_queue');
      const due = rows
        .filter((row) => row.next_attempt_at <= nowIso && (row.locked_at === null || row.locked_at === undefined))
        .sort((a, b) => (a.next_attempt_at < b.next_attempt_at ? -1 : a.next_attempt_at > b.next_attempt_at ? 1 : 0))
        .slice(0, limit);
      for (const row of due) {
        await db.update(
          'sync_queue',
          { event_id: row.event_id },
          { locked_at: nowIso, updated_at: nowIso },
        );
      }
      return due.map((row) => toItem(row, nowIso));
    },

    async reschedule(eventId: string, nextAttemptAt: string): Promise<void> {
      await db.update(
        'sync_queue',
        { event_id: eventId },
        { next_attempt_at: nextAttemptAt, locked_at: null, updated_at: new Date().toISOString() },
      );
    },

    async release(eventId: string): Promise<void> {
      await db.update(
        'sync_queue',
        { event_id: eventId },
        { locked_at: null, updated_at: new Date().toISOString() },
      );
    },

    async remove(eventId: string): Promise<void> {
      await db.delete('sync_queue', { event_id: eventId });
    },
  };
}
