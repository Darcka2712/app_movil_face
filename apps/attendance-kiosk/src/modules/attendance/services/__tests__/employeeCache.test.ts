import { HttpClient } from '@face/api-client';
import { createMemoryDatabase, migrate, type Database } from '@face/database';
import {
  EmployeeCache,
  syncEmployeeCache,
  type EmployeeCacheEntry,
} from '../employeeCache';

const entry: EmployeeCacheEntry = {
  id_empleado: 10,
  codigo_empleado: 'EMP001',
  nombre: 'Juan',
  apellido_paterno: 'Pérez',
  apellido_materno: null,
};

async function makeDb(): Promise<Database> {
  const db = createMemoryDatabase();
  await migrate(db);
  return db;
}

describe('EmployeeCache', () => {
  let db: Database;
  let cache: EmployeeCache;

  beforeEach(async () => {
    db = await makeDb();
    cache = new EmployeeCache(db);
  });

  afterEach(async () => {
    await db.close();
  });

  it('refreshFromServer inserts entries with cached_at and returns count', async () => {
    const count = await cache.refreshFromServer([entry]);

    expect(count).toBe(1);
    const rows = await db.select<EmployeeCacheEntry & { cached_at: string }>(
      'employees_cache',
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject(entry);
    expect(typeof rows[0]?.cached_at).toBe('string');
    expect(Number.isNaN(Date.parse(rows[0]?.cached_at ?? ''))).toBe(false);
  });

  it('upsert replaces by id_empleado instead of duplicating', async () => {
    await cache.refreshFromServer([entry]);
    await cache.refreshFromServer([
      { ...entry, nombre: 'Juan Carlos', codigo_empleado: 'EMP001-B' },
    ]);

    const rows = await db.select<EmployeeCacheEntry>('employees_cache');
    expect(rows).toHaveLength(1);
    expect(rows[0]?.nombre).toBe('Juan Carlos');
    expect(rows[0]?.codigo_empleado).toBe('EMP001-B');
    await expect(cache.count()).resolves.toBe(1);
  });

  it('refreshFromServer with empty list is a no-op returning 0', async () => {
    await cache.refreshFromServer([entry]);
    await expect(cache.refreshFromServer([])).resolves.toBe(0);
    await expect(cache.count()).resolves.toBe(1);
  });

  it('findByCodigo matches case-insensitive after trim', async () => {
    await cache.refreshFromServer([entry]);

    await expect(cache.findByCodigo('  emp001 ')).resolves.toMatchObject(entry);
    await expect(cache.findByCodigo('EMP001')).resolves.toMatchObject(entry);
    await expect(cache.findByCodigo('nope')).resolves.toBeNull();
  });

  it('findByCodigo matches stored codigo with whitespace/case', async () => {
    await cache.refreshFromServer([{ ...entry, codigo_empleado: ' emp001 ' }]);

    const found = await cache.findByCodigo('EMP001');
    expect(found?.id_empleado).toBe(10);
    expect(found?.codigo_empleado).toBe(' emp001 ');
  });

  it('count reflects rows', async () => {
    await expect(cache.count()).resolves.toBe(0);
    await cache.refreshFromServer([
      entry,
      { ...entry, id_empleado: 11, codigo_empleado: 'EMP002' },
    ]);
    await expect(cache.count()).resolves.toBe(2);
  });
});

describe('syncEmployeeCache', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('listEmpleados → refreshFromServer, returns count', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ success: true, data: [entry] }),
    }) as unknown as typeof fetch;
    const client = new HttpClient({
      baseUrl: 'http://localhost:3002/api/v1',
      getDeviceKey: () => 'dk_test',
    });
    const db = await makeDb();

    const count = await syncEmployeeCache(client, db);

    expect(count).toBe(1);
    await expect(new EmployeeCache(db).findByCodigo('emp001')).resolves.toMatchObject(entry);
    await db.close();
  });

  it('propagates fetch failure without writing rows', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ success: false, message: 'boom' }),
    }) as unknown as typeof fetch;
    const client = new HttpClient({
      baseUrl: 'http://localhost:3002/api/v1',
      getDeviceKey: () => 'dk_test',
    });
    const db = await makeDb();

    await expect(syncEmployeeCache(client, db)).rejects.toThrow();
    await expect(new EmployeeCache(db).count()).resolves.toBe(0);
    await db.close();
  });
});
