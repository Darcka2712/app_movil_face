import { HttpClient } from '@face/api-client';
import { login, fetchMe, logoutRequest } from '../contracts';

describe('auth contracts', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('login posts credentials and invokes onToken with data.token', async () => {
    const loginData = {
      message: 'ok',
      user: { id: 1, nombre: 'A', usuario: 'a', email: 'a@x.com', rol: 'EMPRESA', id_rol: 2, nivel_acceso: 'empresa', tipo_usuario: 'dashboard', id_corporativo: 1 },
      token: 'jwt-1',
    };
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ success: true, message: 'ok', data: loginData }),
    }) as unknown as typeof fetch;

    const client = new HttpClient({ baseUrl: 'http://x/api/v1' });
    const onToken = jest.fn().mockResolvedValue(undefined);

    const result = await login(client, { user: 'a', password: 'Secret1' }, onToken);

    expect(result.token).toBe('jwt-1');
    expect(onToken).toHaveBeenCalledWith('jwt-1');
    expect(result.user.id).toBe(1);
  });

  it('login propagates HttpError on invalid credentials', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ success: false, error: 'INVALID_TOKEN', message: 'Credenciales' }),
    }) as unknown as typeof fetch;

    const client = new HttpClient({ baseUrl: 'http://x/api/v1' });
    await expect(login(client, { user: 'a', password: 'bad' }, jest.fn())).rejects.toMatchObject({
      status: 401,
      code: 'INVALID_TOKEN',
    });
  });

  it('fetchMe uses auth header', async () => {
    const mockFetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        success: true,
        data: { id: 9, nombre: 'B', usuario: 'b', email: 'b@x.com', rol: 'EMPRESA', id_rol: 2, nivel_acceso: 'empresa', tipo_usuario: 'dashboard', id_corporativo: 1 },
      }),
    });
    global.fetch = mockFetch as unknown as typeof fetch;

    const client = new HttpClient({
      baseUrl: 'http://x/api/v1',
      getAccessToken: () => 'tok',
    });
    const me = await fetchMe(client);
    expect(me.id).toBe(9);

    const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer tok');
  });

  it('logoutRequest posts to /usuarios/logout with auth', async () => {
    const mockFetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ success: true, message: 'ok', data: null }),
    });
    global.fetch = mockFetch as unknown as typeof fetch;

    const client = new HttpClient({
      baseUrl: 'http://x/api/v1',
      getAccessToken: () => 'tok',
    });
    await logoutRequest(client);

    const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('http://x/api/v1/usuarios/logout');
    expect(init.method).toBe('POST');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer tok');
  });
});
