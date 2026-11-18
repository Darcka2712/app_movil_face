import type { Database } from '@face/database';
import { computeBackoffMs } from './backoff';
import type {
  AttendanceEvent,
  AttendanceRepository,
  NewAttendanceEvent,
  SyncQueue,
  SyncResult,
  SyncTransport,
} from './types';

function addMs(iso: string, ms: number): string {
  return new Date(new Date(iso).getTime() + ms).toISOString();
}

export class SyncEngine {
  private inFlight = false;

  constructor(
    private repo: AttendanceRepository,
    private queue: SyncQueue,
    private transport: SyncTransport,
    private now: () => string,
    private db: Pick<Database, 'transaction'>,
  ) {}

  async enqueue(event: NewAttendanceEvent): Promise<void> {
    const eventId = event.eventId ?? crypto.randomUUID();
    await this.db.transaction(async () => {
      await this.repo.insert({
        ...event,
        eventId,
        syncStatus: 'PENDING',
        attemptCount: 0,
      });
      await this.queue.enqueue(eventId, this.now());
    });
  }

  async findForEmployeeDay(
    employeeId: number,
    dayKey: string,
  ): Promise<AttendanceEvent[]> {
    return this.repo.findForEmployeeDay(employeeId, dayKey);
  }

  async syncPending(limit = 50): Promise<SyncResult[]> {
    if (this.inFlight) return [];
    this.inFlight = true;
    try {
      const claimed = await this.queue.claimDue(this.now(), limit);
      if (claimed.length === 0) return [];

      const events: AttendanceEvent[] = [];
      for (const item of claimed) {
        const event = await this.repo.getByEventId(item.eventId);
        if (event) events.push(event);
        else await this.queue.release(item.eventId);
      }
      if (events.length === 0) return [];

      let results: SyncResult[];
      try {
        results = await this.transport.sendBatch(events);
      } catch (err) {
        const reason = err instanceof Error ? err.message : String(err);
        for (const event of events) await this.retry(event, reason);
        throw err;
      }

      const responded = new Set(results.map((r) => r.eventId));
      for (const result of results) {
        if (result.status === 'REJECTED') {
          await this.repo.updateStatus(result.eventId, 'REJECTED', {
            lastError: result.message ?? result.errorCode,
          });
        } else {
          await this.repo.updateStatus(result.eventId, 'SYNCED');
        }
        await this.queue.remove(result.eventId);
      }
      for (const event of events) {
        if (!responded.has(event.eventId)) await this.retry(event);
      }
      return results;
    } finally {
      this.inFlight = false;
    }
  }

  async getPendingCount(): Promise<number> {
    return this.repo.countByStatus('PENDING');
  }

  private async retry(event: AttendanceEvent, lastError?: string): Promise<void> {
    const attemptCount = event.attemptCount + 1;
    await this.repo.updateStatus(event.eventId, 'PENDING', {
      attemptCount,
      ...(lastError !== undefined && { lastError }),
    });
    await this.queue.reschedule(
      event.eventId,
      addMs(this.now(), computeBackoffMs(attemptCount)),
    );
  }
}
