import { HttpClient } from '../client';
import { HttpError, NetworkError } from '../errors';

const okEnvelope = {
  success: true,
  message: 'ok',
  data: { id: 1 },
  timestamp: new Date().toISOString(),
};

describe('HttpClient', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('unwraps success envelope data', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => okEnvelope,
    }) as unknown as typeof fetch;

    const client = new HttpClient({ baseUrl: 'http://localhost:3002/api/v1' });
    await expect(client.get<{ id: number }>('/usuarios/me')).resolves.toEqual({ id: 1 });
  });

  it('throws HttpError with code on success:false', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 401,
      json: async () => ({ success: false, error: 'UNAUTHORIZED', message: 'Token invalid' }),
    }) as unknown as typeof fetch;

    const client = new HttpClient({ baseUrl: 'http://x/api/v1' });
    await expect(client.get('/usuarios/me')).rejects.toMatchObject({
      name: 'HttpError',
      status: 401,
      code: 'UNAUTHORIZED',
      message: 'Token invalid',
    });
  });

  it('throws HttpError on HTTP error status', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 403,
      json: async () => ({ success: false, error: 'FORBIDDEN', message: 'Sin permiso' }),
    }) as unknown as typeof fetch;

    const client = new HttpClient({ baseUrl: 'http://x/api/v1' });
    await expect(client.get('/x')).rejects.toMatchObject({
      status: 403,
      code: 'FORBIDDEN',
    });
  });

  it('throws NetworkError when fetch rejects', async () => {
    global.fetch = jest.fn().mockRejectedValue(new TypeError('Failed to fetch')) as unknown as typeof fetch;

    const client = new HttpClient({ baseUrl: 'http://x/api/v1' });
    await expect(client.get('/x')).rejects.toBeInstanceOf(NetworkError);
  });

  it('attaches X-Device-Key when device:true', async () => {
    const mockFetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => okEnvelope,
    });
    global.fetch = mockFetch as unknown as typeof fetch;

    const client = new HttpClient({
      baseUrl: 'http://x/api/v1',
      getDeviceKey: () => 'dk_test',
    });
    await client.get('/device/empleados', { device: true });

    const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect((init.headers as Record<string, string>)['X-Device-Key']).toBe('dk_test');
  });

  it('throws NetworkError when device:true and no key', async () => {
    const client = new HttpClient({ baseUrl: 'http://x/api/v1' });
    await expect(client.get('/device/empleados', { device: true })).rejects.toBeInstanceOf(
      NetworkError,
    );
  });

  it('attaches Authorization when auth:true and token present', async () => {
    const mockFetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => okEnvelope,
    });
    global.fetch = mockFetch as unknown as typeof fetch;

    const client = new HttpClient({
      baseUrl: 'http://x/api/v1',
      getAccessToken: () => 'jwt-value',
    });
    await client.get('/usuarios/me', { auth: true });

    const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer jwt-value');
  });

  it('sends JSON body on post', async () => {
    const mockFetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => okEnvelope,
    });
    global.fetch = mockFetch as unknown as typeof fetch;

    const client = new HttpClient({ baseUrl: 'http://x/api/v1', getDeviceKey: () => 'dk_test' });
    await client.post('/device/asistencia/entrada', { codigo: 'EMP001' }, { device: true });

    const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(init.method).toBe('POST');
    expect(init.body).toBe(JSON.stringify({ codigo: 'EMP001' }));
  });
});
