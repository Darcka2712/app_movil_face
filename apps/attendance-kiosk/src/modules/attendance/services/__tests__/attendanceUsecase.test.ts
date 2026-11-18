import { createMemoryDatabase, migrate, type Database } from '@face/database';
import {
  SyncEngine,
  createAttendanceRepository,
  createSyncQueue,
  type SyncTransport,
} from '@face/offline-sync';
import { EmployeeCache, type EmployeeCacheEntry } from '../employeeCache';
import { recordAttendance, type AttendanceDeps } from '../attendanceUsecase';

const EMP: EmployeeCacheEntry = {
  id_empleado: 10,
  codigo_empleado: 'EMP001',
  nombre: 'Juan',
  apellido_paterno: 'Pérez',
  apellido_materno: null,
};

interface Setup {
  deps: AttendanceDeps;
  db: Database;
  engine: SyncEngine;
}

async function makeSetup(now: Date = new Date(2026, 10, 18, 15, 0, 0)): Promise<Setup> {
  const db = createMemoryDatabase();
  await migrate(db);
  const cache = new EmployeeCache(db);
  await cache.refreshFromServer([EMP]);
  const repo = createAttendanceRepository(db);
  const queue = createSyncQueue(db);
  const transport: SyncTransport = { sendBatch: jest.fn(async () => []) };
  const engine = new SyncEngine(repo, queue, transport, () => now.toISOString(), db);
  return { deps: { cache, engine, now: () => now }, db, engine };
}

describe('recordAttendance', () => {
  it('unknown codigo returns UNKNOWN_EMPLOYEE without enqueue', async () => {
    const { deps, db, engine } = await makeSetup();
    const enqueue = jest.spyOn(engine, 'enqueue');

    const result = await recordAttendance(deps, 'NOPE');

    expect(result).toEqual({
      ok: false,
      code: 'UNKNOWN_EMPLOYEE',
      message: expect.any(String),
    });
    expect(enqueue).not.toHaveBeenCalled();
    await db.close();
  });

  it('empty codigo returns UNKNOWN_EMPLOYEE without enqueue', async () => {
    const { deps, db, engine } = await makeSetup();
    const enqueue = jest.spyOn(engine, 'enqueue');

    const result = await recordAttendance(deps, '   ');

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('UNKNOWN_EMPLOYEE');
    expect(enqueue).not.toHaveBeenCalled();
    await db.close();
  });

  it('first scan enqueues ENTRY persisted before returning ok', async () => {
    const { deps, db, engine } = await makeSetup();
    const enqueue = jest.spyOn(engine, 'enqueue');

    const result = await recordAttendance(deps, 'emp001');

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.eventType).toBe('ENTRY');
      expect(typeof result.eventId).toBe('string');
      expect(result.eventId.length).toBeGreaterThan(0);
    }
    expect(enqueue).toHaveBeenCalledTimes(1);
    expect(enqueue).toHaveBeenCalledWith(
      expect.objectContaining({
        eventId: expect.any(String),
        employeeId: 10,
        deviceId: 'kiosk',
        eventType: 'ENTRY',
      }),
    );
    if (result.ok) {
      const persisted = await createAttendanceRepository(db).getByEventId(result.eventId);
      expect(persisted).toMatchObject({ eventType: 'ENTRY', syncStatus: 'PENDING' });
    }
    await db.close();
  });

  it('second scan same day enqueues EXIT', async () => {
    const { deps, db, engine } = await makeSetup();
    const enqueue = jest.spyOn(engine, 'enqueue');

    await recordAttendance(deps, 'EMP001');
    const result = await recordAttendance(deps, 'EMP001');

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.eventType).toBe('EXIT');
    expect(enqueue).toHaveBeenCalledTimes(2);
    expect(enqueue).toHaveBeenLastCalledWith(expect.objectContaining({ eventType: 'EXIT' }));
    await db.close();
  });

  it('after ENTRY and EXIT returns DAY_CLOSED without enqueue', async () => {
    const { deps, db, engine } = await makeSetup();
    const enqueue = jest.spyOn(engine, 'enqueue');

    await recordAttendance(deps, 'EMP001');
    await recordAttendance(deps, 'EMP001');
    const result = await recordAttendance(deps, 'EMP001');

    expect(result).toEqual({
      ok: false,
      code: 'DAY_CLOSED',
      message: expect.any(String),
    });
    expect(enqueue).toHaveBeenCalledTimes(2);
    await db.close();
  });

  it('enqueue rejection returns ENQUEUE_FAILED', async () => {
    const { deps, db, engine } = await makeSetup();
    jest.spyOn(engine, 'enqueue').mockRejectedValueOnce(new Error('disk full'));

    const result = await recordAttendance(deps, 'EMP001');

    expect(result).toEqual({
      ok: false,
      code: 'ENQUEUE_FAILED',
      message: expect.any(String),
    });
    await db.close();
  });

  it('normalizes input casing and whitespace', async () => {
    const { deps, db } = await makeSetup();

    const result = await recordAttendance(deps, '  emp001  ');

    expect(result.ok).toBe(true);
    const rows = await db.select<{ codigo: string }>('attendance_events');
    expect(rows[0]?.codigo).toBe('EMP001');
    await db.close();
  });
});
