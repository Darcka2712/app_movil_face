import { MemorySecureStorage } from '@face/auth';
import { bootstrapSecureStorage } from '../bootstrap';

describe('bootstrapSecureStorage', () => {
  it('injects storage and hydrates on success', async () => {
    const storage = new MemorySecureStorage();
    const inject = jest.fn();
    const hydrate = jest.fn().mockResolvedValue(undefined);

    const result = await bootstrapSecureStorage({
      createStorage: async () => storage,
      inject,
      hydrate,
    });

    expect(result).toBe('ok');
    expect(inject).toHaveBeenCalledWith(storage);
    expect(hydrate).toHaveBeenCalledTimes(1);
  });

  it('returns fallback when createStorage throws', async () => {
    const inject = jest.fn();
    const hydrate = jest.fn();

    const result = await bootstrapSecureStorage({
      createStorage: async () => {
        throw new Error('SecureStore unavailable');
      },
      inject,
      hydrate,
    });

    expect(result).toBe('fallback');
    expect(inject).not.toHaveBeenCalled();
    expect(hydrate).not.toHaveBeenCalled();
  });

  it('returns fallback when hydrate throws after inject', async () => {
    const inject = jest.fn();

    const result = await bootstrapSecureStorage({
      createStorage: async () => new MemorySecureStorage(),
      inject,
      hydrate: async () => {
        throw new Error('hydrate failed');
      },
    });

    expect(result).toBe('fallback');
    expect(inject).toHaveBeenCalledTimes(1);
  });

  it('returns fallback when cancelled before inject', async () => {
    const inject = jest.fn();
    const hydrate = jest.fn();

    const result = await bootstrapSecureStorage(
      {
        createStorage: async () => new MemorySecureStorage(),
        inject,
        hydrate,
      },
      () => true,
    );

    expect(result).toBe('fallback');
    expect(inject).not.toHaveBeenCalled();
    expect(hydrate).not.toHaveBeenCalled();
  });

  it('returns fallback when cancelled after hydrate starts', async () => {
    let calls = 0;
    const inject = jest.fn();

    const result = await bootstrapSecureStorage(
      {
        createStorage: async () => new MemorySecureStorage(),
        inject,
        hydrate: async () => {
          calls += 1;
        },
      },
      () => calls > 0,
    );

    expect(result).toBe('fallback');
    expect(inject).toHaveBeenCalledTimes(1);
  });
});
