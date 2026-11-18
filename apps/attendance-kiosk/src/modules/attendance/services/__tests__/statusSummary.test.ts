import { createMemoryDatabase, migrate, type Database } from '@face/database';
import { createAttendanceRepository } from '@face/offline-sync';
import type { AttendanceEvent } from '@face/offline-sync';
import { loadStatusSummary } from '../statusSummary';

function event(
  eventId: string,
  syncStatus: AttendanceEvent['syncStatus'],
): AttendanceEvent {
  return {
    eventId,
    employeeId: 1,
    codigo: 'EMP001',
    deviceId: 'kiosk',
    eventType: 'ENTRY',
    occurredAt: '2026-11-18T09:00:00.000Z',
    syncStatus,
    attemptCount: 0,
  };
}

describe('loadStatusSummary', () => {
  let db: Database;

  beforeEach(async () => {
    db = createMemoryDatabase();
    await migrate(db);
  });

  afterEach(async () => {
    await db.close();
  });

  it('counts PENDING, SYNCED and REJECTED events exactly', async () => {
    const repo = createAttendanceRepository(db);
    await repo.insert(event('e1', 'PENDING'));
    await repo.insert(event('e2', 'PENDING'));
    await repo.insert(event('e3', 'SYNCED'));
    await repo.insert(event('e4', 'REJECTED'));

    const summary = await loadStatusSummary(repo);

    expect(summary).toEqual({ pending: 2, synced: 1, rejected: 1 });
  });

  it('returns zeros on empty database', async () => {
    const repo = createAttendanceRepository(db);

    await expect(loadStatusSummary(repo)).resolves.toEqual({
      pending: 0,
      synced: 0,
      rejected: 0,
    });
  });
});
