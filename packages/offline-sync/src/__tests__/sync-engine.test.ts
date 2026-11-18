import { createMemoryDatabase } from '@face/database';
import type { Database } from '@face/database';
import { NetworkError } from '@face/api-client';
import { createAttendanceRepository } from '../attendance-repository';
import { createSyncQueue } from '../sync-queue';
import { SyncEngine } from '../sync-engine';
import type {
  AttendanceEvent,
  NewAttendanceEvent,
  SyncResult,
  SyncTransport,
} from '../types';

const NOW = '2026-11-18T10:00:00.000Z';
const LATER = '2026-11-18T10:10:00.000Z';

function makeNew(overrides: Partial<NewAttendanceEvent> = {}): NewAttendanceEvent {
  return {
    employeeId: 42,
    codigo: 'A123',
    deviceId: 'dev_1',
    eventType: 'ENTRY',
    occurredAt: '2026-11-18T09:59:00.000Z',
    ...overrides,
  };
}

function synced(events: AttendanceEvent[]): SyncResult[] {
  return events.map((e) => ({ eventId: e.eventId, status: 'SYNCED' as const, serverRecordId: 1 }));
}

async function setup(
  transport: SyncTransport,
): Promise<{
  db: Database;
  repo: ReturnType<typeof createAttendanceRepository>;
  queue: ReturnType<typeof createSyncQueue>;
  engine: SyncEngine;
  clock: { now: string };
}> {
  const db = createMemoryDatabase();
  await db.exec(`CREATE TABLE IF NOT EXISTS attendance_events (
    event_id TEXT PRIMARY KEY,
    employee_id INTEGER,
    codigo TEXT,
    device_id TEXT NOT NULL,
    event_type TEXT NOT NULL,
    occurred_at TEXT NOT NULL,
    sync_status TEXT NOT NULL,
    attempt_count INTEGER NOT NULL,
    last_error TEXT,
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS sync_queue (
    event_id TEXT PRIMARY KEY,
    next_attempt_at TEXT NOT NULL,
    locked_at TEXT,
    updated_at TEXT NOT NULL
  );`);
  const repo = createAttendanceRepository(db);
  const queue = createSyncQueue(db);
  const clock = { now: NOW };
  const engine = new SyncEngine(repo, queue, transport, () => clock.now, db);
  return { db, repo, queue, engine, clock };
}

describe('SyncEngine', () => {
  it('syncs 3 pending events: all SYNCED, pending 0, queue empty', async () => {
    const transport: SyncTransport = { sendBatch: async (events) => synced(events) };
    const { engine, db } = await setup(transport);
    await engine.enqueue({ ...makeNew(), eventId: 'e1' });
    await engine.enqueue({ ...makeNew(), eventId: 'e2' });
    await engine.enqueue({ ...makeNew(), eventId: 'e3' });

    const results = await engine.syncPending();

    expect(results).toHaveLength(3);
    expect(results.every((r) => r.status === 'SYNCED')).toBe(true);
    await expect(engine.getPendingCount()).resolves.toBe(0);
    await expect(db.select('sync_queue')).resolves.toHaveLength(0);
  });

  it('REJECTED result marks event REJECTED, removes from queue, not retried', async () => {
    const transport: SyncTransport = {
      sendBatch: async (events) =>
        events.map((e) =>
          e.eventId === 'bad'
            ? {
                eventId: e.eventId,
                status: 'REJECTED' as const,
                errorCode: 'CREDENCIAL_NO_ENCONTRADA',
                message: 'Credencial no encontrada',
              }
            : { eventId: e.eventId, status: 'SYNCED' as const },
        ),
    };
    const { engine, repo, db } = await setup(transport);
    await engine.enqueue({ ...makeNew(), eventId: 'good' });
    await engine.enqueue({ ...makeNew(), eventId: 'bad' });

    const results = await engine.syncPending();

    expect(results.find((r) => r.eventId === 'bad')?.status).toBe('REJECTED');
    await expect(repo.getByEventId('bad')).resolves.toMatchObject({
      syncStatus: 'REJECTED',
      lastError: 'Credencial no encontrada',
    });
    const queueRows = await db.select<{ event_id: string }>('sync_queue');
    expect(queueRows.map((r) => r.event_id)).not.toContain('bad');
    await expect(engine.syncPending()).resolves.toEqual([]);
  });

  it('transport NetworkError → attemptCount 1, still PENDING, queue rescheduled', async () => {
    const transport: SyncTransport = {
      sendBatch: jest.fn(async () => {
        throw new NetworkError('Network request failed');
      }),
    };
    const { engine, repo, db } = await setup(transport);
    await engine.enqueue({ ...makeNew(), eventId: 'e1' });

    await expect(engine.syncPending()).rejects.toBeInstanceOf(NetworkError);

    await expect(repo.getByEventId('e1')).resolves.toMatchObject({
      syncStatus: 'PENDING',
      attemptCount: 1,
    });
    const [row] = await db.select<{ next_attempt_at: string; locked_at: string | null }>(
      'sync_queue',
    );
    expect(row?.locked_at ?? null).toBeNull();
    expect((row?.next_attempt_at ?? '') > NOW).toBe(true);
  });

  it('rejects duplicate eventId on enqueue (PK), queue keeps single item', async () => {
    const transport: SyncTransport = { sendBatch: async () => [] };
    const { engine, db } = await setup(transport);
    await engine.enqueue({ ...makeNew(), eventId: 'dup' });

    await expect(engine.enqueue({ ...makeNew(), eventId: 'dup' })).rejects.toThrow(
      /duplicate primary key/i,
    );
    await expect(db.select('sync_queue')).resolves.toHaveLength(1);
  });

  it('does not regenerate eventId on retry (randomUUID called once)', async () => {
    let calls = 0;
    const sendBatch = jest.fn(async (events: AttendanceEvent[]) => {
      calls += 1;
      if (calls === 1) throw new NetworkError('net down');
      return synced(events);
    });
    const { engine, clock } = await setup({ sendBatch });
    const randomSpy = jest.spyOn(globalThis.crypto, 'randomUUID');
    try {
      await engine.enqueue(makeNew());
      expect(randomSpy).toHaveBeenCalledTimes(1);

      await expect(engine.syncPending()).rejects.toBeInstanceOf(NetworkError);

      clock.now = LATER;
      const results = await engine.syncPending();
      expect(results).toEqual([expect.objectContaining({ status: 'SYNCED' })]);
      expect(sendBatch).toHaveBeenCalledTimes(2);
      const first = (sendBatch.mock.calls[0]?.[0] ?? []) as AttendanceEvent[];
      const second = (sendBatch.mock.calls[1]?.[0] ?? []) as AttendanceEvent[];
      expect(second[0]?.eventId).toBe(first[0]?.eventId);
      expect(randomSpy).toHaveBeenCalledTimes(1);
    } finally {
      randomSpy.mockRestore();
    }
  });

  it('parallel syncPending: second returns [] and transport called once', async () => {
    let release: (() => void) | undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const sendBatch = jest.fn(async (events: AttendanceEvent[]) => {
      await gate;
      return synced(events);
    });
    const { engine } = await setup({ sendBatch });
    await engine.enqueue({ ...makeNew(), eventId: 'e1' });

    const first = engine.syncPending();
    const second = engine.syncPending();
    release?.();
    const [r1, r2] = await Promise.all([first, second]);

    expect(r1).toHaveLength(1);
    expect(r2).toEqual([]);
    expect(sendBatch).toHaveBeenCalledTimes(1);
  });

  it('events missing from transport response get attemptCount++ and reschedule', async () => {
    const transport: SyncTransport = {
      sendBatch: async (events) => synced(events.filter((e) => e.eventId !== 'e2')),
    };
    const { engine, repo, db } = await setup(transport);
    await engine.enqueue({ ...makeNew(), eventId: 'e1' });
    await engine.enqueue({ ...makeNew(), eventId: 'e2' });

    const results = await engine.syncPending();

    expect(results).toHaveLength(1);
    await expect(repo.getByEventId('e1')).resolves.toMatchObject({ syncStatus: 'SYNCED' });
    await expect(repo.getByEventId('e2')).resolves.toMatchObject({
      syncStatus: 'PENDING',
      attemptCount: 1,
    });
    const queueRows = await db.select<{ event_id: string; locked_at: string | null }>(
      'sync_queue',
    );
    expect(queueRows.map((r) => r.event_id)).toEqual(['e2']);
    expect(queueRows[0]?.locked_at ?? null).toBeNull();
  });

  it('enqueue generates eventId via crypto.randomUUID when missing', async () => {
    const transport: SyncTransport = { sendBatch: async (events) => synced(events) };
    const { engine, repo } = await setup(transport);
    await engine.enqueue(makeNew());
    const pending = await repo.listByStatus('PENDING', 10);
    expect(pending).toHaveLength(1);
    expect(pending[0]?.eventId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );
  });
});
