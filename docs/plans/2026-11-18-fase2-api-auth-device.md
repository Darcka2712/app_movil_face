# FACE Mobile Fase 2 — API Client, Auth, Device Identity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Typed API client, centralized HTTP errors, SecureStore adapter, auth/device contracts matching the real FACE Nexus backend, device identity (X-Device-Key) storage, TanStack Query provider — wired into attendance-kiosk. No offline sync, no scanner.

**Architecture:** Two new packages under `packages/`: `api-client` (fetch wrapper, error hierarchy, `{success,data}` unwrap) and `auth` (SecureStore adapter interface + Expo impl + memory impl for tests, credential storage, backend auth contracts as types + client functions). Attendance-kiosk gains QueryClientProvider and uses device-key identity for `/api/v1/device/*` calls. Backend untouched (ADR-011).

**Tech Stack:** TypeScript strict, native `fetch`, expo-secure-store, @tanstack/react-query v5, Zod 4 (contracts), Jest 30 (apps) / Jest 29 (shared-types pattern → auth/api-client use Jest 29 + ts-jest like shared-types OR align to workspace — use jest 29 + ts-jest as packages pattern from Task 2).

## Global Constraints

- Node `>=24.14.0`; TypeScript `strict: true`; no `any`
- No tokens/secrets in AsyncStorage, SQLite, logs, or `EXPO_PUBLIC_*`
- SecureStore only for credentials (device API key, access/refresh tokens if used)
- Backend response envelope: `{ success: true, message?, data, pagination?, timestamp }` or `{ success: false, error?, message, timestamp? }`
- Auth base: `POST /api/v1/usuarios/login` body `{user, password}` → data `{ message, rol, user, token }` + Set-Cookie `access_token`, `refresh_token` (httpOnly)
- Refresh: `POST /api/v1/usuarios/refresh` reads **cookie only** (`refresh_token`) — body has no token field; response sets new cookies + data `{ message, user }` (access token NOT in refresh response body)
- Logout: `POST /api/v1/usuarios/logout`
- Me: `GET /api/v1/usuarios/me` Bearer or access_token cookie
- Device auth: header `X-Device-Key`; routes `/api/v1/device/*`; CSRF bypassed for this header+path
- Device endpoints used Fase 2: `GET /device/empleados`, `POST /device/asistencia/entrada|salida`
- Device DTO: XOR `id_empleado` ↔ `codigo`; optional `timestamp` ISO
- Kiosk identity = admin-provisioned X-Device-Key (ADR-011); **no self-registration endpoint exists**
- JWT refresh cookie-only = **mobile gap**: document in ADR; do NOT invent body-refresh contract; kiosk path does not need JWT (uses device key)
- HTTPS required outside development (existing `readEnv`)
- Work only under `app-movil/`; no backend edits
- Zod already in backend; mobile may use Zod for response parse — only where it prevents runtime breakage (login user shape, device DTO responses)

## Contract notes (verified, not invented)

Login response `data.user`: `{ id, nombre, usuario, email, rol, id_rol, nivel_acceso, tipo_usuario, id_corporativo, arbol_permisos }` (AuthService.js:232-243).

Error HTTP examples: 401 `{success:false, error:'UNAUTHORIZED'|'INVALID_TOKEN'|..., message}`; 403 CSRF `{error:'CSRF_TOKEN_MISSING'|'CSRF_TOKEN_INVALID'}`; device 401 `{success:false, message:'API key requerida'|'API key inválida o dispositivo inactivo'}`.

---

### Task 1: `packages/api-client`

**Files:**
- Create: `app-movil/packages/api-client/package.json`
- Create: `app-movil/packages/api-client/tsconfig.json`
- Create: `app-movil/packages/api-client/jest.config.cjs`
- Create: `app-movil/packages/api-client/src/index.ts`
- Create: `app-movil/packages/api-client/src/errors.ts`
- Create: `app-movil/packages/api-client/src/client.ts`
- Create: `app-movil/packages/api-client/src/__tests__/client.test.ts`
- Modify: none (root workspace picks up `packages/*`)

**Interfaces:**
- Consumes: `@face/shared-types` `ApiResponse` (optional re-export use)
- Produces:
  - `HttpClient` class: `constructor(opts: { baseUrl: string; getAccessToken?: () => string | null; getDeviceKey?: () => string | null })`
  - `request<T>(path, init?: RequestInit & { device?: boolean; auth?: boolean }): Promise<T>` — returns unwrapped `data`
  - `ApiError` with `status`, `code`, `message`
  - subclasses/network: `NetworkError`, `HttpError`
  - command `pnpm --filter @face/api-client typecheck` PASS, `test` PASS

- [ ] **Step 1: Write `package.json`**

```json
{
  "name": "@face/api-client",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "exports": {
    ".": "./src/index.ts"
  },
  "scripts": {
    "lint": "eslint .",
    "typecheck": "tsc --noEmit",
    "test": "jest"
  },
  "dependencies": {
    "@face/shared-types": "workspace:*"
  },
  "devDependencies": {
    "@types/jest": "29.5.14",
    "jest": "29.7.0",
    "ts-jest": "29.4.5",
    "typescript": "5.9.3",
    "eslint": "9.39.1",
    "typescript-eslint": "8.46.2"
  }
}
```

- [ ] **Step 2: Write `tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src",
    "lib": ["es2022", "dom"]
  },
  "include": ["src"]
}
```

Note: `dom` lib for `fetch`/`RequestInit`/`Response` types in tests/node. RN provides fetch at runtime.

- [ ] **Step 3: Write `jest.config.cjs`**

```js
/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.test.ts'],
};
```

- [ ] **Step 4: Write `src/errors.ts`**

```ts
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(message: string, status: number, code: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

export class HttpError extends ApiError {
  constructor(message: string, status: number, code: string) {
    super(message, status, code);
    this.name = 'HttpError';
  }
}

export class NetworkError extends ApiError {
  constructor(message: string) {
    super(message, 0, 'NETWORK');
    this.name = 'NetworkError';
  }
}
```

- [ ] **Step 5: Write `src/client.ts`**

```ts
import { HttpError, NetworkError } from './errors.js';

export interface HttpClientOptions {
  baseUrl: string;
  getAccessToken?: () => string | null;
  getDeviceKey?: () => string | null;
}

export interface RequestOptions extends Omit<RequestInit, 'headers'> {
  headers?: Record<string, string>;
  /** Attach X-Device-Key (device routes) */
  device?: boolean;
  /** Attach Authorization: Bearer (user JWT) */
  auth?: boolean;
}

interface Envelope {
  success?: boolean;
  message?: string;
  error?: string;
  data?: unknown;
  timestamp?: string;
}

export class HttpClient {
  private readonly baseUrl: string;
  private readonly getAccessToken?: () => string | null;
  private readonly getDeviceKey?: () => string | null;

  constructor(opts: HttpClientOptions) {
    this.baseUrl = opts.baseUrl.replace(/\/$/, '');
    this.getAccessToken = opts.getAccessToken;
    this.getDeviceKey = opts.getDeviceKey;
  }

  async request<T>(path: string, options: RequestOptions = {}): Promise<T> {
    const { device, auth, headers = {}, ...rest } = options;
    const url = `${this.baseUrl}${path.startsWith('/') ? path : `/${path}`}`;

    const finalHeaders: Record<string, string> = {
      Accept: 'application/json',
      ...headers,
    };

    if (rest.body !== undefined && !finalHeaders['Content-Type']) {
      finalHeaders['Content-Type'] = 'application/json';
    }

    if (device) {
      const key = this.getDeviceKey?.();
      if (!key) {
        throw new NetworkError('Device key not configured');
      }
      finalHeaders['X-Device-Key'] = key;
    }

    if (auth) {
      const token = this.getAccessToken?.();
      if (token) {
        finalHeaders.Authorization = `Bearer ${token}`;
      }
    }

    let response: Response;
    try {
      response = await fetch(url, { ...rest, headers: finalHeaders });
    } catch {
      throw new NetworkError('Network request failed');
    }

    let body: Envelope | null = null;
    try {
      body = (await response.json()) as Envelope;
    } catch {
      body = null;
    }

    if (!response.ok) {
      const code = body?.error ?? body?.message ?? `HTTP_${response.status}`;
      const message = body?.message ?? `Request failed with status ${response.status}`;
      throw new HttpError(message, response.status, code);
    }

    if (body && body.success === false) {
      const code = body.error ?? 'APP_ERROR';
      throw new HttpError(body.message ?? 'Request failed', response.status, code);
    }

    if (body && 'success' in body) {
      return body.data as T;
    }

    return body as T;
  }

  get<T>(path: string, options?: RequestOptions): Promise<T> {
    return this.request<T>(path, { ...options, method: 'GET' });
  }

  post<T>(path: string, body?: unknown, options?: RequestOptions): Promise<T> {
    return this.request<T>(path, {
      ...options,
      method: 'POST',
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  }
}
```

- [ ] **Step 6: Write `src/index.ts`**

```ts
export { HttpClient } from './client.js';
export type { HttpClientOptions, RequestOptions } from './client.js';
export { ApiError, HttpError, NetworkError } from './errors.js';
```

- [ ] **Step 7: Write failing test `src/__tests__/client.test.ts`**

```ts
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
    }) as unknown as typeof fetch;
    global.fetch = mockFetch;

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
    }) as unknown as typeof fetch;
    global.fetch = mockFetch;

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
    }) as unknown as typeof fetch;
    global.fetch = mockFetch;

    const client = new HttpClient({ baseUrl: 'http://x/api/v1' });
    await client.post('/device/asistencia/entrada', { codigo: 'EMP001' }, { device: true });

    const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(init.method).toBe('POST');
    expect(init.body).toBe(JSON.stringify({ codigo: 'EMP001' }));
  });
});
```

- [ ] **Step 8: Install and verify**

```powershell
Set-Location "C:\Users\ZARAGOZA051\Desktop\nexus\app-movil"
pnpm install
pnpm --filter @face/api-client typecheck
pnpm --filter @face/api-client test
```

Expected: typecheck clean; jest PASS all.

- [ ] **Step 9: Commit**

```powershell
git add packages/api-client pnpm-lock.yaml
git commit -m "feat(api-client): typed HttpClient with error hierarchy"
```

---

### Task 2: `packages/auth` — SecureStore + credentials + backend contracts

**Files:**
- Create: `app-movil/packages/auth/package.json`
- Create: `app-movil/packages/auth/tsconfig.json`
- Create: `app-movil/packages/auth/jest.config.cjs`
- Create: `app-movil/packages/auth/src/index.ts`
- Create: `app-movil/packages/auth/src/secure-storage.ts`
- Create: `app-movil/packages/auth/src/credentials.ts`
- Create: `app-movil/packages/auth/src/contracts.ts`
- Create: `app-movil/packages/auth/src/__tests__/credentials.test.ts`
- Create: `app-movil/packages/auth/src/__tests__/contracts.test.ts`

**Interfaces:**
- Consumes: `@face/api-client` `HttpClient`, `HttpError`
- Produces:
  - `SecureStorage` interface: `getItem(key): Promise<string|null>`, `setItem(key,value): Promise<void>`, `removeItem(key): Promise<void>`
  - `MemorySecureStorage` (tests)
  - `createExpoSecureStorage()` — dynamic import wrapper for expo-secure-store (apps inject; package must not hard-depend on native module at test time)
  - `CredentialStore` class: keys `access_token`, `refresh_token`, `device_key`; methods `setAccessToken/getAccessToken/setRefreshToken/getRefreshToken/clearUserTokens/setDeviceKey/getDeviceKey/clearDeviceKey`
  - contracts: `LoginRequest`, `LoginUser`, `LoginData`, `login(client, req): Promise<LoginData>` storing token via callback/credentials
  - `fetchMe(client): Promise<LoginUser>` with auth:true
  - command typecheck + test PASS

- [ ] **Step 1: Write `package.json`**

```json
{
  "name": "@face/auth",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "exports": {
    ".": "./src/index.ts"
  },
  "scripts": {
    "lint": "eslint .",
    "typecheck": "tsc --noEmit",
    "test": "jest"
  },
  "dependencies": {
    "@face/api-client": "workspace:*",
    "@face/shared-types": "workspace:*"
  },
  "devDependencies": {
    "@types/jest": "29.5.14",
    "jest": "29.7.0",
    "ts-jest": "29.4.5",
    "typescript": "5.9.3",
    "eslint": "9.39.1",
    "typescript-eslint": "8.46.2"
  }
}
```

- [ ] **Step 2: Write `tsconfig.json` and `jest.config.cjs`** — same as api-client Task 1 Steps 2-3 (extends `../../tsconfig.base.json`, ts-jest node).

- [ ] **Step 3: Write `src/secure-storage.ts`**

```ts
export interface SecureStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

export class MemorySecureStorage implements SecureStorage {
  private readonly map = new Map<string, string>();

  async getItem(key: string): Promise<string | null> {
    return this.map.get(key) ?? null;
  }

  async setItem(key: string, value: string): Promise<void> {
    this.map.set(key, value);
  }

  async removeItem(key: string): Promise<void> {
    this.map.delete(key);
  }
}

/**
 * Factory for Expo SecureStore. Apps call this and inject into CredentialStore.
 * Dynamic import keeps jest/node tests free of native module.
 */
export async function createExpoSecureStorage(): Promise<SecureStorage> {
  const SecureStore = await import('expo-secure-store');
  return {
    getItem: (key) => SecureStore.getItemAsync(key),
    setItem: (key, value) => SecureStore.setItemAsync(key, value),
    removeItem: (key) => SecureStore.deleteItemAsync(key),
  };
}
```

Note: `expo-secure-store` is a peer/optional — apps install it. Package.json does NOT list it as dependency; apps pass instance. Add `peerDependencies` optional:

```json
"peerDependencies": {
  "expo-secure-store": "*"
},
"peerDependenciesMeta": {
  "expo-secure-store": { "optional": true }
}
```

Merge into package.json from Step 1.

- [ ] **Step 4: Write `src/credentials.ts`**

```ts
import type { SecureStorage } from './secure-storage.js';

const KEY_ACCESS = 'face_access_token';
const KEY_REFRESH = 'face_refresh_token';
const KEY_DEVICE = 'face_device_key';

export class CredentialStore {
  constructor(private readonly storage: SecureStorage) {}

  setAccessToken(token: string): Promise<void> {
    return this.storage.setItem(KEY_ACCESS, token);
  }

  getAccessToken(): Promise<string | null> {
    return this.storage.getItem(KEY_ACCESS);
  }

  setRefreshToken(token: string): Promise<void> {
    return this.storage.setItem(KEY_REFRESH, token);
  }

  getRefreshToken(): Promise<string | null> {
    return this.storage.getItem(KEY_REFRESH);
  }

  setDeviceKey(key: string): Promise<void> {
    return this.storage.setItem(KEY_DEVICE, key);
  }

  getDeviceKey(): Promise<string | null> {
    return this.storage.getItem(KEY_DEVICE);
  }

  async clearUserTokens(): Promise<void> {
    await this.storage.removeItem(KEY_ACCESS);
    await this.storage.removeItem(KEY_REFRESH);
  }

  async clearDeviceKey(): Promise<void> {
    await this.storage.removeItem(KEY_DEVICE);
  }

  async clearAll(): Promise<void> {
    await this.clearUserTokens();
    await this.clearDeviceKey();
  }
}
```

- [ ] **Step 5: Write `src/contracts.ts`**

```ts
import type { HttpClient } from '@face/api-client';

export interface LoginRequest {
  user: string;
  password: string;
}

export interface LoginUser {
  id: number;
  nombre: string;
  usuario: string;
  email: string;
  rol: string;
  id_rol: number | null;
  nivel_acceso: string;
  tipo_usuario: string;
  id_corporativo: number | null;
  arbol_permisos?: unknown;
}

export interface LoginData {
  message: string;
  rol?: string;
  user: LoginUser;
  token: string;
}

export async function login(
  client: HttpClient,
  req: LoginRequest,
  onToken: (token: string) => Promise<void>,
): Promise<LoginData> {
  const data = await client.post<LoginData>('/usuarios/login', req);
  await onToken(data.token);
  return data;
}

export async function fetchMe(client: HttpClient): Promise<LoginUser> {
  return client.get<LoginUser>('/usuarios/me', { auth: true });
}

export async function logoutRequest(client: HttpClient): Promise<void> {
  await client.post<unknown>('/logout', undefined, { auth: true });
}
```

Note: logout path is `/usuarios/logout` under base `/api/v1` → path `/usuarios/logout`.

Fix: `client.post<unknown>('/usuarios/logout', ...)`.

- [ ] **Step 6: Write `src/index.ts`**

```ts
export type { SecureStorage } from './secure-storage.js';
export { MemorySecureStorage, createExpoSecureStorage } from './secure-storage.js';
export { CredentialStore } from './credentials.js';
export type { LoginRequest, LoginUser, LoginData } from './contracts.js';
export { login, fetchMe, logoutRequest } from './contracts.js';
```

- [ ] **Step 7: Write tests**

`src/__tests__/credentials.test.ts`:

```ts
import { CredentialStore } from '../credentials';
import { MemorySecureStorage } from '../secure-storage';

describe('CredentialStore', () => {
  it('stores and retrieves device key', async () => {
    const store = new CredentialStore(new MemorySecureStorage());
    await store.setDeviceKey('dk_abc');
    await expect(store.getDeviceKey()).resolves.toBe('dk_abc');
  });

  it('stores access and refresh tokens separately', async () => {
    const store = new CredentialStore(new MemorySecureStorage());
    await store.setAccessToken('a1');
    await store.setRefreshToken('r1');
    await expect(store.getAccessToken()).resolves.toBe('a1');
    await expect(store.getRefreshToken()).resolves.toBe('r1');
  });

  it('clearUserTokens does not clear device key', async () => {
    const store = new CredentialStore(new MemorySecureStorage());
    await store.setAccessToken('a1');
    await store.setDeviceKey('dk');
    await store.clearUserTokens();
    await expect(store.getAccessToken()).resolves.toBeNull();
    await expect(store.getDeviceKey()).resolves.toBe('dk');
  });

  it('clearAll removes everything', async () => {
    const store = new CredentialStore(new MemorySecureStorage());
    await store.setAccessToken('a');
    await store.setRefreshToken('r');
    await store.setDeviceKey('d');
    await store.clearAll();
    await expect(store.getAccessToken()).resolves.toBeNull();
    await expect(store.getRefreshToken()).resolves.toBeNull();
    await expect(store.getDeviceKey()).resolves.toBeNull();
  });

  it('returns null for missing keys', async () => {
    const store = new CredentialStore(new MemorySecureStorage());
    await expect(store.getAccessToken()).resolves.toBeNull();
    await expect(store.getDeviceKey()).resolves.toBeNull();
  });
});
```

`src/__tests__/contracts.test.ts`:

```ts
import { HttpClient } from '@face/api-client';
import { login, fetchMe } from '../contracts';

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
    }) as unknown as typeof fetch;
    global.fetch = mockFetch;

    const client = new HttpClient({
      baseUrl: 'http://x/api/v1',
      getAccessToken: () => 'tok',
    });
    const me = await fetchMe(client);
    expect(me.id).toBe(9);

    const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer tok');
  });
});
```

- [ ] **Step 8: Fix logout path**

In contracts.ts ensure logout uses `'/usuarios/logout'` not `'/logout'`.

- [ ] **Step 9: Install and verify**

```powershell
pnpm install
pnpm --filter @face/auth typecheck
pnpm --filter @face/auth test
```

Expected: PASS.

- [ ] **Step 10: Commit**

```powershell
git add packages/auth pnpm-lock.yaml
git commit -m "feat(auth): secure credentials store and backend auth contracts"
```

---

### Task 3: ADR-012 JWT refresh cookie gap + docs contracts note

**Files:**
- Create: `app-movil/docs/adr/ADR-012-jwt-refresh-cookie-mobile.md`
- Create: `app-movil/docs/API_CONTRACTS.md`

**Interfaces:**
- Consumes: verified backend behavior from Global Constraints
- Produces: decision record; contracts reference for Fase 2+

- [ ] **Step 1: Write ADR-012**

```markdown
# ADR-012: JWT refresh token is cookie-only — mobile gap documented

## Status
Accepted 2026-11-18 (documented; no backend change)

## Context
Backend login sets httpOnly cookies access_token + refresh_token and also
returns access token in response body (data.token). Refresh endpoint
POST /api/v1/usuarios/refresh reads ONLY req.cookies.refresh_token and
returns new tokens via Set-Cookie; response body has no token field.

React Native / Expo fetch does not persist httpOnly cookies like a browser.
Storing refresh token from Set-Cookie is unreliable without a cookie jar.

## Decision
1. Attendance Kiosk MVP uses X-Device-Key only (ADR-011) — no JWT refresh needed.
2. User JWT flows (Workforce) store access token from login body in SecureStore.
3. Do NOT invent a body-based refresh contract. When Workforce needs silent
   refresh, propose backend change: accept refresh_token in body OR return
   refresh_token in login/refresh JSON for `X-Client-Type: mobile`.
4. Until then: expired access token → re-login (explicit).

## Consequences
- Kiosk unaffected
- Workforce MVP may require interactive re-login after access TTL (24h backend)
- Backend change needs approval per architecture rules
```

- [ ] **Step 2: Write `docs/API_CONTRACTS.md`**

```markdown
# FACE Mobile API Contracts (verified against backend-main)

Base URL: EXPO_PUBLIC_API_BASE_URL (default http://localhost:3002/api/v1)

## Envelope
Success: { success: true, message?, data, pagination?, timestamp }
Failure: { success: false, error?, message, timestamp? }

## Auth (user JWT)
| Method | Path | Auth | Notes |
|--------|------|------|-------|
| POST | /usuarios/login | none (CSRF public) | body {user,password} → data.token (access). Cookies also set. |
| POST | /usuarios/refresh | cookie refresh_token only | see ADR-012 |
| POST | /usuarios/logout | Bearer or cookie | clears cookies server-side |
| GET | /usuarios/me | Bearer | data = LoginUser shape |

## Device (X-Device-Key, CSRF bypassed)
| Method | Path | Permission | Body |
|--------|------|------------|------|
| GET | /device/empleados | empleados READ | — |
| POST | /device/asistencia/entrada | asistencia CREATE | XOR id_empleado|codigo + optional timestamp |
| POST | /device/asistencia/salida | asistencia CREATE | same |

Device key provisioned by admin: POST /api/v1/dispositivos (web JWT).
No self-registration endpoint.

## Error codes seen
UNAUTHORIZED, INVALID_TOKEN, TOKEN_REVOKED, FORBIDDEN,
CSRF_TOKEN_MISSING, CSRF_TOKEN_INVALID,
API key messages on device 401.
```

- [ ] **Step 3: Commit**

```powershell
git add docs/adr/ADR-012-jwt-refresh-cookie-mobile.md docs/API_CONTRACTS.md
git commit -m "docs: ADR-012 refresh cookie gap and verified API contracts"
```

---

### Task 4: Wire attendance-kiosk — providers, device credential, device API usage

**Files:**
- Modify: `app-movil/apps/attendance-kiosk/package.json` (deps: @face/api-client, @face/auth, @tanstack/react-query, expo-secure-store)
- Create: `app-movil/apps/attendance-kiosk/src/config/client.ts`
- Create: `app-movil/apps/attendance-kiosk/src/providers/AppProviders.tsx`
- Create: `app-movil/apps/attendance-kiosk/app/_layout.tsx` (wrap providers)
- Create: `app-movil/apps/attendance-kiosk/src/modules/attendance/services/deviceApi.ts`
- Create: `app-movil/apps/attendance-kiosk/src/modules/attendance/services/__tests__/deviceApi.test.ts`
- Modify: `app-movil/apps/attendance-kiosk/app/index.tsx` (minimal: show env + device key provisioned status)

**Interfaces:**
- Consumes: Task 1 `HttpClient`, Task 2 `CredentialStore`, `MemorySecureStorage`/`createExpoSecureStorage`
- Produces:
  - `getHttpClient(): HttpClient` singleton using env baseUrl + device key getter
  - `AppProviders` React component with QueryClientProvider
  - `listEmpleados(client): Promise<EmpleadoMin[]>` via GET /device/empleados device:true
  - `EmpleadoMin` type — **must inspect backend DeviceAsistenciaService.getEmpleados return shape before coding** (read `backend-main/src/modules/device/services/DeviceAsistenciaService.js` getEmpleados)
  - tests PASS without native SecureStore

- [ ] **Step 1: Read backend getEmpleados shape**

Read `C:\Users\ZARAGOZA051\Desktop\nexus\backend-main\src\modules\device\services\DeviceAsistenciaService.js` method `getEmpleados` — extract exact JSON fields returned. Use those for `EmpleadoMin`.

- [ ] **Step 2: Add dependencies to attendance-kiosk package.json**

```json
"@face/api-client": "workspace:*",
"@face/auth": "workspace:*",
"@tanstack/react-query": "^5.90.0",
"expo-secure-store": "~58.0.0"
```

(Use `npx expo install expo-secure-store` if version unknown; pin what expo resolves.)

- [ ] **Step 3: Write `src/config/client.ts`**

```ts
import { HttpClient } from '@face/api-client';
import { CredentialStore, MemorySecureStorage, type SecureStorage } from '@face/auth';
import { getEnv } from './env';

let storage: SecureStorage | null = null;
let credentials: CredentialStore | null = null;
let client: HttpClient | null = null;

export function injectStorage(instance: SecureStorage): void {
  storage = instance;
  credentials = new CredentialStore(instance);
  client = null;
}

export function getCredentials(): CredentialStore {
  if (!credentials) {
    // Test/default fallback: in-memory (production calls injectStorage with Expo SecureStore at boot)
    credentials = new CredentialStore(new MemorySecureStorage());
  }
  return credentials;
}

export function getHttpClient(): HttpClient {
  if (!client) {
    const creds = getCredentials();
    client = new HttpClient({
      baseUrl: getEnv().apiBaseUrl,
      getDeviceKey: () => {
        // sync bridge: CredentialStore is async; device key cached at boot
        return deviceKeyCache;
      },
    });
  }
  return client;
}

let deviceKeyCache: string | null = null;

export async function hydrateDeviceKey(): Promise<void> {
  deviceKeyCache = await getCredentials().getDeviceKey();
}

export function setDeviceKeyCache(key: string | null): void {
  deviceKeyCache = key;
}
```

Simplification allowed: if async bridge is awkward, `HttpClient.getDeviceKey` can be sync-only reading `deviceKeyCache`; boot sequence: create Expo storage → CredentialStore → hydrateDeviceKey → render UI.

- [ ] **Step 4: Write `src/providers/AppProviders.tsx`**

```tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
      gcTime: 5 * 60_000,
    },
  },
});

export function AppProviders({ children }: { children: ReactNode }) {
  const [client] = useState(() => queryClient);
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
```

- [ ] **Step 5: Wrap `app/_layout.tsx`**

```tsx
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { AppProviders } from '../src/providers/AppProviders';

export default function RootLayout() {
  return (
    <AppProviders>
      <StatusBar style="auto" />
      <Stack screenOptions={{ headerShown: false }} />
    </AppProviders>
  );
}
```

- [ ] **Step 6: Write `deviceApi.ts` with types from Step 1**

Example skeleton — replace field list with real backend shape:

```ts
import type { HttpClient } from '@face/api-client';

/** Fields verified from DeviceAsistenciaService.getEmpleados — adjust to actual */
export interface EmpleadoMin {
  id_empleado: number;
  codigo_empleado?: string;
  nombre?: string;
  [key: string]: unknown;
}

export function listEmpleados(client: HttpClient): Promise<EmpleadoMin[]> {
  return client.get<EmpleadoMin[]>('/device/empleados', { device: true });
}
```

If backend returns `{ success, data: { empleados: [...] } }` or wrapped object, unwrap accordingly in this function (inspect Step 1).

- [ ] **Step 7: Write deviceApi test**

Mock fetch; assert `device:true` header path and array (or object) unwrap matches Step 1 shape.

- [ ] **Step 8: Update `app/index.tsx` minimal**

Show env.environment + whether device key is provisioned (after hydrate). No attendance flow yet (Fase 4).

- [ ] **Step 9: Boot SecureStore injection**

In `_layout.tsx` or a small `bootstrap.ts` called from `_layout` via `useEffect` once:

```ts
import { createExpoSecureStorage, CredentialStore } from '@face/auth';
import { injectStorage, hydrateDeviceKey, setDeviceKeyCache } from '../config/client';

useEffect(() => {
  let cancelled = false;
  (async () => {
    const storage = await createExpoSecureStorage();
    if (cancelled) return;
    injectStorage(storage);
    await hydrateDeviceKey();
  })();
  return () => { cancelled = true; };
}, []);
```

- [ ] **Step 10: Install, typecheck, test**

```powershell
pnpm install
pnpm --filter attendance-kiosk typecheck
pnpm --filter attendance-kiosk test
```

- [ ] **Step 11: Commit**

```powershell
git add apps/attendance-kiosk pnpm-lock.yaml
git commit -m "feat(attendance-kiosk): wire api-client auth and query provider"
```

---

### Task 5: Full doctor + status update

**Files:**
- Modify: `app-movil/docs/PLAN_FASE1_STATUS.md` → add Fase 2 section or create `docs/PLAN_FASE2_STATUS.md`
- Verify: `pnpm doctor`

**Interfaces:**
- Consumes: Tasks 1-4
- Produces: all packages green; status doc accurate

- [ ] **Step 1: Run `pnpm doctor`** — fix only blocking errors.

- [ ] **Step 2: Write `docs/PLAN_FASE2_STATUS.md`**

```markdown
# Fase 2 Status

- [x] @face/api-client — HttpClient, HttpError/NetworkError, envelope unwrap
- [x] @face/auth — SecureStorage, CredentialStore, login/fetchMe/logout contracts
- [x] ADR-012 JWT refresh cookie-only gap documented
- [x] docs/API_CONTRACTS.md verified against backend
- [x] attendance-kiosk: QueryClientProvider + device key hydration + deviceApi
- [ ] Real device key provisioned on tablet (admin flow)
- [ ] Live login against running backend (optional for kiosk path)
- [ ] Fase 3: scanner, sqlite, offline-sync (needs sync endpoint ADR)
```

- [ ] **Step 3: Commit**

```powershell
git add docs/PLAN_FASE2_STATUS.md
git commit -m "docs: fase2 status"
```

---

## Out of Scope (later)

| Item | Phase |
|------|-------|
| Offline sync batch + eventId | Fase 3 (needs backend endpoint + ADR) |
| Scanner/camera | Fase 3 |
| SQLite | Fase 3 |
| Attendance flows UI | Fase 4 |
| JWT silent refresh | Blocked on ADR-012 backend decision |
| Workforce/Inventory feature modules | Fase 5-6 |

## Self-Review Notes

- Spec coverage Fase 2: API client ✓, HTTP errors ✓, SecureStore ✓, auth contracts ✓, tenant via fetchMe/LoginUser ✓, device identity (key storage, no fake register) ✓, TanStack Query ✓, env already Fase 1 ✓.
- Placeholders: Task 4 Step 1 forces reading real getEmpleados shape before typing — not a placeholder, a verification gate.
- Type consistency: HttpClient same across packages; CredentialStore keys namespaced `face_*`.
