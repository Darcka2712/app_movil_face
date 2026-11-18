import { HttpClient } from '@face/api-client';
import { createMemoryDatabase, migrate, type Database } from '@face/database';
import { createMemoryConnectivity } from '@face/offline-sync';
import { createSyncRuntime, type SyncRuntime } from '../syncRuntime';

const BASE_URL = 'http://localhost:3002/api/v1';

function makeRuntime(
  database: Database,
  online: boolean,
): { runtime: SyncRuntime; fetchMock: jest.Mock } {
  const fetchMock = jest.fn().mockResolvedValue({
    ok: true,
    status: 201,
    json: async () => ({ success: true, data: {} }),
  });
  global.fetch = fetchMock as unknown as typeof fetch;
  const client = new HttpClient({
    baseUrl: BASE_URL,
    getDeviceKey: () => 'dk_test',
  });
  const runtime = createSyncRuntime({
    client,
    deviceId: 'kiosk',
    database,
    connectivity: createMemoryConnectivity(online),
  });
  return { runtime, fetchMock };
}

async function makeDb(): Promise<Database> {
  const db = createMemoryDatabase();
  await migrate(db);
  return db;
}

function newEvent() {
  return {
    employeeId: 42,
    codigo: 'EMP001',
    deviceId: 'kiosk',
    eventType: 'ENTRY' as const,
    occurredAt: '2026-11-18T09:59:00.000Z',
  };
}

describe('createSyncRuntime', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('enqueue + syncNow marks event SYNCED via real 201 response', async () => {
    const db = await makeDb();
    const { runtime, fetchMock } = makeRuntime(db, true);

    await runtime.engine.enqueue(newEvent());
    await expect(runtime.getPendingCount()).resolves.toBe(1);

    await runtime.syncNow();

    await expect(runtime.getPendingCount()).resolves.toBe(0);
    const rows = await db.select<{ sync_status: string }>('attendance_events');
    expect(rows).toHaveLength(1);
    expect(rows[0]?.sync_status).toBe('SYNCED');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url] = fetchMock.mock.calls[0] as [string];
    expect(url).toBe(`${BASE_URL}/device/entrada`);
  });

  it('offline connectivity: syncNow no-ops, event stays PENDING', async () => {
    const db = await makeDb();
    const { runtime, fetchMock } = makeRuntime(db, false);

    await runtime.engine.enqueue(newEvent());
    await runtime.syncNow();

    expect(fetchMock).not.toHaveBeenCalled();
    await expect(runtime.getPendingCount()).resolves.toBe(1);
    const rows = await db.select<{ sync_status: string }>('attendance_events');
    expect(rows[0]?.sync_status).toBe('PENDING');
  });

  it('syncNow swallows network errors: event stays PENDING, no throw', async () => {
    const db = await makeDb();
    const { runtime, fetchMock } = makeRuntime(db, true);
    fetchMock.mockRejectedValue(new Error('network down'));

    await runtime.engine.enqueue(newEvent());
    await expect(runtime.syncNow()).resolves.toBeUndefined();
    await expect(runtime.getPendingCount()).resolves.toBe(1);
  });
});
