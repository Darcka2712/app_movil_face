import type { SecureStorage } from './secure-storage';

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
