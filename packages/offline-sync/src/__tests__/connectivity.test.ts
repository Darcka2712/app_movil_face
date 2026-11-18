import { createMemoryConnectivity } from '../connectivity';

describe('createMemoryConnectivity', () => {
  it('reports online when constructed with true', async () => {
    await expect(createMemoryConnectivity(true).isOnline()).resolves.toBe(true);
  });

  it('reports offline when constructed with false', async () => {
    await expect(createMemoryConnectivity(false).isOnline()).resolves.toBe(false);
  });
});
