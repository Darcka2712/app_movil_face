import { HttpClient } from '@face/api-client';
import { CredentialStore, MemorySecureStorage, type SecureStorage } from '@face/auth';
import { getEnv } from './env';

let credentials: CredentialStore | null = null;
let client: HttpClient | null = null;
let deviceKeyCache: string | null = null;
const listeners = new Set<() => void>();

export function injectStorage(instance: SecureStorage): void {
  credentials = new CredentialStore(instance);
  client = null;
}

export function getCredentials(): CredentialStore {
  if (!credentials) {
    credentials = new CredentialStore(new MemorySecureStorage());
  }
  return credentials;
}

export function getHttpClient(): HttpClient {
  if (!client) {
    client = new HttpClient({
      baseUrl: getEnv().apiBaseUrl,
      getDeviceKey: () => deviceKeyCache,
    });
  }
  return client;
}

export async function hydrateDeviceKey(): Promise<void> {
  deviceKeyCache = await getCredentials().getDeviceKey();
  notifyDeviceKey();
}

export function setDeviceKeyCache(key: string | null): void {
  deviceKeyCache = key;
  notifyDeviceKey();
}

export function getDeviceKeyProvisioned(): boolean {
  return deviceKeyCache !== null;
}

export function subscribeDeviceKey(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function notifyDeviceKey(): void {
  listeners.forEach((listener) => listener());
}
