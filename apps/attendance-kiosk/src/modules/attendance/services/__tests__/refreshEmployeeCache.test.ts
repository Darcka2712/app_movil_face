import { NetworkError } from '@face/api-client';
import { markDeviceKeyReady, setDeviceKeyCache } from '../../../../config/client';
import { getKioskAttendanceRuntime, refreshEmployeeCache } from '../attendanceRuntime';
import { getKioskSyncRuntime } from '../syncRuntime';

const BASE_URL = 'http://localhost:3002/api/v1';
const EMP = {
  id_empleado: 10,
  codigo_empleado: 'EMP001',
  nombre: 'Juan',
  apellido_paterno: 'Pérez',
  apellido_materno: null,
};

function offlineFetch() {
  global.fetch = jest.fn(async () => {
    throw new Error('offline');
  }) as unknown as typeof fetch;
}

function onlineFetch() {
  global.fetch = jest.fn(async (url: string) => {
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
  }) as unknown as typeof fetch;
}

describe('refreshEmployeeCache', () => {
  const originalFetch = global.fetch;

  beforeAll(async () => {
    process.env.EXPO_PUBLIC_ENVIRONMENT = 'development';
    process.env.EXPO_PUBLIC_API_BASE_URL = BASE_URL;
    markDeviceKeyReady();
    setDeviceKeyCache('dk_test');
    offlineFetch();
    await getKioskAttendanceRuntime();
  });

  afterAll(() => {
    global.fetch = originalFetch;
  });

  it('rejects when offline after failed boot, cache stays empty', async () => {
    const sync = await getKioskSyncRuntime();
    expect(await sync.database.select('employees_cache')).toHaveLength(0);

    await expect(refreshEmployeeCache()).rejects.toThrow(NetworkError);
  });

  it('syncs employees and returns count when back online', async () => {
    onlineFetch();

    await expect(refreshEmployeeCache()).resolves.toBe(1);
    const sync = await getKioskSyncRuntime();
    expect(await sync.database.select('employees_cache')).toHaveLength(1);
  });
});
