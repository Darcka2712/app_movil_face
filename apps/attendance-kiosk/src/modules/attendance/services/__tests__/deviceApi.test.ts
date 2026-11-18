import { HttpClient } from '@face/api-client';
import { listEmpleados, type EmpleadoMin } from '../deviceApi';

const empleado: EmpleadoMin = {
  id_empleado: 10,
  nombre: 'Juan',
  apellido_paterno: 'Pérez',
  apellido_materno: null,
  codigo_empleado: 'EMP001',
};

describe('listEmpleados', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  function mockFetchEnvelope(data: unknown) {
    const mock = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ success: true, data }),
    });
    global.fetch = mock as unknown as typeof fetch;
    return mock;
  }

  function makeClient(deviceKey?: string) {
    return new HttpClient({
      baseUrl: 'http://localhost:3002/api/v1',
      getDeviceKey: () => deviceKey ?? null,
    });
  }

  it('GETs /device/empleados with X-Device-Key and unwraps array', async () => {
    const mock = mockFetchEnvelope([empleado]);

    const result = await listEmpleados(makeClient('dk_test'));

    expect(result).toEqual([empleado]);
    const [url, init] = mock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('http://localhost:3002/api/v1/device/empleados');
    expect(init.method).toBe('GET');
    expect((init.headers as Record<string, string>)['X-Device-Key']).toBe('dk_test');
  });

  it('passes through empty array when device has no assigned empleados', async () => {
    mockFetchEnvelope([]);
    await expect(listEmpleados(makeClient('dk_test'))).resolves.toEqual([]);
  });

  it('rejects when device key missing', async () => {
    await expect(listEmpleados(makeClient())).rejects.toThrow(/Device key not configured/);
  });
});
