import { createDedupeFilter } from '../dedupe';
import type { ScanResult } from '../types';

function result(value: string, scannedAt: string): ScanResult {
  return { value, format: 'CODE128', source: 'hid', scannedAt };
}

describe('createDedupeFilter', () => {
  it('rejects same value within window', () => {
    const filter = createDedupeFilter(1000);
    expect(filter(result('A', '2026-01-01T00:00:00.000Z'))).toBe(true);
    expect(filter(result('A', '2026-01-01T00:00:00.500Z'))).toBe(false);
  });

  it('accepts same value after window', () => {
    const filter = createDedupeFilter(1000);
    expect(filter(result('A', '2026-01-01T00:00:00.000Z'))).toBe(true);
    expect(filter(result('A', '2026-01-01T00:00:02.000Z'))).toBe(true);
  });

  it('accepts different values', () => {
    const filter = createDedupeFilter(1000);
    expect(filter(result('A', '2026-01-01T00:00:00.000Z'))).toBe(true);
    expect(filter(result('B', '2026-01-01T00:00:00.100Z'))).toBe(true);
  });
});
