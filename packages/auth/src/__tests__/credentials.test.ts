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
