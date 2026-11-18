import { createFakeScanner } from '../fake-scanner';
import type { ScanResult, ScannerConfig } from '../types';

const config: ScannerConfig = {
  acceptedFormats: ['CODE128'],
  duplicateWindowMs: 1000,
};

function result(value: string, scannedAt: string): ScanResult {
  return { value, format: 'CODE128', source: 'hid', scannedAt };
}

describe('createFakeScanner', () => {
  it('ignores emit before start', () => {
    const scanner = createFakeScanner();
    const cb = jest.fn();
    scanner.subscribe(cb);
    scanner.emit(result('A', '2026-01-01T00:00:00.000Z'));
    expect(cb).not.toHaveBeenCalled();
  });

  it('delivers emit to subscriber after start', async () => {
    const scanner = createFakeScanner();
    await scanner.start(config);
    const cb = jest.fn();
    scanner.subscribe(cb);
    scanner.emit(result('A', '2026-01-01T00:00:00.000Z'));
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it('delivers duplicate within window only once', async () => {
    const scanner = createFakeScanner();
    await scanner.start(config);
    const cb = jest.fn();
    scanner.subscribe(cb);
    scanner.emit(result('A', '2026-01-01T00:00:00.000Z'));
    scanner.emit(result('A', '2026-01-01T00:00:00.500Z'));
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it('stops delivering after unsubscribe', async () => {
    const scanner = createFakeScanner();
    await scanner.start(config);
    const cb = jest.fn();
    const unsub = scanner.subscribe(cb);
    unsub();
    scanner.emit(result('A', '2026-01-01T00:00:00.000Z'));
    expect(cb).not.toHaveBeenCalled();
  });

  it('ignores emit after stop', async () => {
    const scanner = createFakeScanner();
    await scanner.start(config);
    const cb = jest.fn();
    scanner.subscribe(cb);
    await scanner.stop();
    scanner.emit(result('A', '2026-01-01T00:00:00.000Z'));
    expect(cb).not.toHaveBeenCalled();
  });
});
