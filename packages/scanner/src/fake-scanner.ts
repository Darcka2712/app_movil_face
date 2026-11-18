import { createDedupeFilter } from './dedupe';
import type { ScanResult, ScannerConfig, ScannerService } from './types';

export function createFakeScanner(): ScannerService & {
  emit(result: ScanResult): void;
} {
  const listeners = new Set<(r: ScanResult) => void>();
  let filter: ((r: ScanResult) => boolean) | null = null;
  let running = false;

  return {
    async start(config: ScannerConfig) {
      filter = createDedupeFilter(config.duplicateWindowMs);
      running = true;
    },
    async stop() {
      running = false;
      filter = null;
    },
    subscribe(callback) {
      listeners.add(callback);
      return () => listeners.delete(callback);
    },
    emit(result) {
      if (!running || !filter) return;
      if (!filter(result)) return;
      for (const cb of listeners) cb(result);
    },
  };
}
