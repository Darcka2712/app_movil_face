import { createMemoryDatabase } from '@face/database';
import type { Database } from '@face/database';
import { createAttendanceRepository } from '../attendance-repository';
import { localDateKey } from '../local-date';
import type { AttendanceEvent } from '../types';

function makeEvent(overrides: Partial<AttendanceEvent> = {}): AttendanceEvent {
  return {
    eventId: 'evt_1',
    employeeId: 42,
    codigo: 'A123',
    deviceId: 'dev_1',
    eventType: 'ENTRY',
    occurredAt: '2026-11-18T10:00:00.000Z',
    syncStatus: 'PENDING',
    attemptCount: 0,
    ...overrides,
  };
}

async function setup(): Promise<{ db: Database; repo: ReturnType<typeof createAttendanceRepository> }> {
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
  );`);
  return { db, repo: createAttendanceRepository(db) };
}

describe('AttendanceRepository', () => {
  it('insert + getByEventId roundtrip', async () => {
    const { repo } = await setup();
    await repo.insert(makeEvent());
    await expect(repo.getByEventId('evt_1')).resolves.toEqual(makeEvent());
  });

  it('roundtrips null employeeId/codigo and lastError', async () => {
    const { repo } = await setup();
    const event = makeEvent({
      eventId: 'evt_2',
      employeeId: null,
      codigo: null,
      syncStatus: 'REJECTED',
      attemptCount: 3,
      lastError: 'boom',
    });
    await repo.insert(event);
    await expect(repo.getByEventId('evt_2')).resolves.toEqual(event);
  });

  it('getByEventId returns null for missing id', async () => {
    const { repo } = await setup();
    await expect(repo.getByEventId('nope')).resolves.toBeNull();
  });

  it('listByStatus filters and respects limit', async () => {
    const { repo } = await setup();
    await repo.insert(makeEvent({ eventId: 'e1', syncStatus: 'PENDING' }));
    await repo.insert(makeEvent({ eventId: 'e2', syncStatus: 'PENDING' }));
    await repo.insert(makeEvent({ eventId: 'e3', syncStatus: 'SYNCED' }));
    const pending = await repo.listByStatus('PENDING', 10);
    expect(pending.map((e) => e.eventId)).toEqual(['e1', 'e2']);
    const limited = await repo.listByStatus('PENDING', 1);
    expect(limited).toHaveLength(1);
  });

  it('updateStatus changes status, attemptCount and lastError', async () => {
    const { repo } = await setup();
    await repo.insert(makeEvent());
    await repo.updateStatus('evt_1', 'SYNCING', { attemptCount: 2, lastError: 'net' });
    const event = await repo.getByEventId('evt_1');
    expect(event?.syncStatus).toBe('SYNCING');
    expect(event?.attemptCount).toBe(2);
    expect(event?.lastError).toBe('net');
    await repo.updateStatus('evt_1', 'SYNCED');
    const synced = await repo.getByEventId('evt_1');
    expect(synced?.syncStatus).toBe('SYNCED');
    expect(synced?.attemptCount).toBe(2);
    expect(synced?.lastError).toBe('net');
  });

  it('findForEmployeeDay filters by employee and local day', async () => {
    const { repo } = await setup();
    const day = new Date(2026, 10, 18, 10, 0, 0);
    const prevDay = new Date(2026, 10, 17, 23, 30, 0);
    await repo.insert(makeEvent({ eventId: 'a', employeeId: 42, occurredAt: day.toISOString() }));
    await repo.insert(makeEvent({ eventId: 'b', employeeId: 43, occurredAt: day.toISOString() }));
    await repo.insert(
      makeEvent({ eventId: 'c', employeeId: 42, occurredAt: prevDay.toISOString() }),
    );

    const events = await repo.findForEmployeeDay(42, localDateKey(day));
    expect(events.map((e) => e.eventId)).toEqual(['a']);
    await expect(repo.findForEmployeeDay(99, localDateKey(day))).resolves.toEqual([]);
  });

  it('countByStatus counts only matching status', async () => {
    const { repo } = await setup();
    await repo.insert(makeEvent({ eventId: 'c1' }));
    await repo.insert(makeEvent({ eventId: 'c2' }));
    await repo.insert(makeEvent({ eventId: 'c3', syncStatus: 'SYNCED' }));
    await expect(repo.countByStatus('PENDING')).resolves.toBe(2);
    await expect(repo.countByStatus('SYNCED')).resolves.toBe(1);
    await expect(repo.countByStatus('REJECTED')).resolves.toBe(0);
  });
});
