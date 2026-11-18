import type { SecureStorage } from '@face/auth';
import { markDeviceKeyReady } from './client';

export interface BootstrapDeps {
  createStorage: () => Promise<SecureStorage>;
  inject: (storage: SecureStorage) => void;
  hydrate: () => Promise<void>;
}

export type BootstrapResult = 'ok' | 'fallback';

/**
 * Initializes SecureStore-backed credentials and hydrates the device key.
 * Returns 'fallback' when SecureStore is unavailable — callers keep MemorySecureStorage.
 */
export async function bootstrapSecureStorage(
  deps: BootstrapDeps,
  isCancelled: () => boolean = () => false,
): Promise<BootstrapResult> {
  try {
    const storage = await deps.createStorage();
    if (isCancelled()) return 'fallback';
    deps.inject(storage);
    await deps.hydrate();
    if (isCancelled()) return 'fallback';
    return 'ok';
  } catch {
    return 'fallback';
  } finally {
    // release sync gates on both ok and fallback paths
    markDeviceKeyReady();
  }
}
