import { createMemoryConnectivity } from '@face/offline-sync';
import { markDeviceKeyReady, setDeviceKeyCache } from '../../../../config/client';
import { createAttendanceRuntime, getKioskAttendanceRuntime } from '../attendanceRuntime';
import { createSyncRuntime, getKioskSyncRuntime } from '../syncRuntime';
import { createMemoryDatabase, migrate, type Database } from '@face/database';
import { HttpClient } from '@face/api-client';

const BASE_URL = 'http://localhost:3002/api/v1';
const EMP = {
  id_empleado: 10,
  codigo_empleado: 'EMP001',
  nombre: 'Juan',
  apellido_paterno: 'Pérez',
  apellido_materno: null,
};

function makeFetchMock() {
  const fetchMock = jest.fn().mockImplementation(async (url: string) => {
    if (String(url).includes('/device/empleados')) {
      return {
        ok: true,
        status: 200,
        json: async () => ({ success: true, data: [EMP] }),
      };
    }
    return {
      ok: true,
      status: 201,
      json: async () => ({ success: true, data: {} }),
    };
  });
  global.fetch = fetchMock as unknown as typeof fetch;
  return fetchMock;
}

async function makeSync(database: Database) {
  const client = new HttpClient({
    baseUrl: BASE_URL,
    getDeviceKey: () => 'dk_test',
  });
  return createSyncRuntime({
    client,
    deviceId: 'kiosk',
    database,
    connectivity: createMemoryConnectivity(true),
  });
}

describe('createAttendanceRuntime', () => {
  const originalFetch = global.fetch;
  let db: Database;

  beforeEach(async () => {
    db = createMemoryDatabase();
    await migrate(db);
    makeFetchMock();
    await db.insert('employees_cache', { ...EMP, cached_at: new Date().toISOString() });
  });

  afterEach(async () => {
    global.fetch = originalFetch;
    await db.close();
  });

  it('record unknown codigo returns UNKNOWN_EMPLOYEE, no enqueue', async () => {
    const runtime = createAttendanceRuntime(await makeSync(db));

    const outcome = await runtime.record('NOPE');

    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.code).toBe('UNKNOWN_EMPLOYEE');
    await expect(
      db.select('attendance_events'),
    ).resolves.toHaveLength(0);
  });

  it('record known codigo persists ENTRY before ok', async () => {
    const runtime = createAttendanceRuntime(await makeSync(db));

    const outcome = await runtime.record('emp001');

    expect(outcome.ok).toBe(true);
    if (outcome.ok) expect(outcome.eventType).toBe('ENTRY');
    const rows = await db.select<{ sync_status: string }>('attendance_events');
    expect(rows).toHaveLength(1);
    expect(rows[0]?.sync_status).toBe('PENDING');
  });

  it('second record same day returns EXIT, third returns DAY_CLOSED', async () => {
    const runtime = createAttendanceRuntime(await makeSync(db));

    await runtime.record('EMP001');
    const second = await runtime.record('EMP001');
    const third = await runtime.record('EMP001');

    expect(second.ok && second.eventType).toBe('EXIT');
    expect(third.ok).toBe(false);
    if (!third.ok) expect(third.code).toBe('DAY_CLOSED');
    await expect(db.select('attendance_events')).resolves.toHaveLength(2);
  });
});

describe('getKioskAttendanceRuntime', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('boot syncs employee cache from server, then record succeeds', async () => {
    process.env.EXPO_PUBLIC_ENVIRONMENT = 'development';
    process.env.EXPO_PUBLIC_API_BASE_URL = BASE_URL;
    makeFetchMock();
    markDeviceKeyReady();
    setDeviceKeyCache('dk_test');

    const runtime = await getKioskAttendanceRuntime();
    const sync = await getKioskSyncRuntime();
    // boot cache refresh is fire-and-forget; wait until employee lands
    for (let i = 0; i < 50; i++) {
      const rows = await sync.database.select('employees_cache');
      if (rows.length > 0) break;
      await new Promise((r) => setTimeout(r, 10));
    }

    const outcome = await runtime.record('EMP001');
    expect(outcome.ok).toBe(true);
  });
});
