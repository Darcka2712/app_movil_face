import type { ScanResult } from './types';

export function createDedupeFilter(windowMs: number) {
  const last = new Map<string, number>();

  return (result: ScanResult): boolean => {
    const now = Date.parse(result.scannedAt);
    const prev = last.get(result.value);
    if (prev !== undefined && now - prev < windowMs) {
      return false;
    }
    last.set(result.value, now);
    if (last.size > 500) {
      const cutoff = now - windowMs;
      for (const [k, t] of last) {
        if (t < cutoff) last.delete(k);
      }
    }
    return true;
  };
}
