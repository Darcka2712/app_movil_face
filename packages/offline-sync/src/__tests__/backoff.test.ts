import { computeBackoffMs } from '../backoff';

describe('computeBackoffMs', () => {
  it('attempt 1 returns base within +20% jitter', () => {
    for (let i = 0; i < 50; i++) {
      const value = computeBackoffMs(1);
      expect(value).toBeGreaterThanOrEqual(5000);
      expect(value).toBeLessThanOrEqual(6000);
    }
  });

  it('grows monotonically with attempts', () => {
    const samples = [1, 2, 3, 4, 5].map((a) => computeBackoffMs(a, 1000, 60_000));
    for (let i = 1; i < samples.length; i++) {
      expect(samples[i]!).toBeGreaterThanOrEqual(samples[i - 1]!);
    }
  });

  it('caps at maxMs (jitter may add up to 20% over cap)', () => {
    const maxMs = 10_000;
    for (let i = 0; i < 50; i++) {
      const value = computeBackoffMs(99, 1000, maxMs);
      expect(value).toBeGreaterThanOrEqual(maxMs);
      expect(value).toBeLessThanOrEqual(Math.floor(maxMs * 1.2));
    }
  });

  it('jitter stays within 20% of exponential value', () => {
    const baseMs = 4000;
    for (let i = 0; i < 100; i++) {
      const value = computeBackoffMs(2, baseMs, 60_000);
      expect(value).toBeGreaterThanOrEqual(8000);
      expect(value).toBeLessThanOrEqual(9600);
    }
  });

  it('attempt 0 or negative clamps to base growth', () => {
    const value = computeBackoffMs(0, 1000, 60_000);
    expect(value).toBeGreaterThanOrEqual(1000);
    expect(value).toBeLessThanOrEqual(1200);
  });
});
