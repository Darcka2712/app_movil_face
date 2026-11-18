import type { ScanResult } from '@face/scanner';
import { buildCameraScanner, createCameraScanner } from '../createCameraScanner';

const fakeCameraModule = { CameraView: () => null };

describe('buildCameraScanner', () => {
  it('returns null without module or CameraView', () => {
    expect(buildCameraScanner(null)).toBeNull();
    expect(buildCameraScanner(undefined)).toBeNull();
    expect(buildCameraScanner({ useCameraPermissions: () => [] })).toBeNull();
  });

  it('delegates start/stop/subscribe and emits camera ScanResult', async () => {
    const scanner = buildCameraScanner(fakeCameraModule);
    if (!scanner) throw new Error('expected scanner');

    const seen: ScanResult[] = [];
    const unsubscribe = scanner.subscribe((r) => seen.push(r));

    scanner.ingest('EMP001', 'qr');
    expect(seen).toHaveLength(0);

    await scanner.start({ acceptedFormats: ['qr'], duplicateWindowMs: 60_000 });
    scanner.ingest('EMP001', 'qr');
    expect(seen).toEqual([
      { value: 'EMP001', format: 'qr', source: 'camera', scannedAt: expect.any(String) },
    ]);

    await scanner.stop();
    scanner.ingest('EMP002', 'qr');
    expect(seen).toHaveLength(1);

    unsubscribe();
  });

  it('dedupes repeated codes and drops rejected formats', async () => {
    const scanner = buildCameraScanner(fakeCameraModule);
    if (!scanner) throw new Error('expected scanner');
    const seen: ScanResult[] = [];
    scanner.subscribe((r) => seen.push(r));
    await scanner.start({ acceptedFormats: ['qr'], duplicateWindowMs: 60_000 });

    scanner.ingest('EMP001', 'qr');
    scanner.ingest('EMP001', 'qr');
    scanner.ingest('EMP002', 'ean13');
    expect(seen.map((r) => r.value)).toEqual(['EMP001']);

    scanner.ingest('EMP003', 'qr');
    expect(seen.map((r) => r.value)).toEqual(['EMP001', 'EMP003']);
  });
});

describe('createCameraScanner', () => {
  it('returns null when expo-camera module is absent', async () => {
    expect(await createCameraScanner()).toBeNull();
  });

  it('returns null when module loader rejects', async () => {
    const scanner = await createCameraScanner(() =>
      Promise.reject(new Error('Cannot find module expo-camera')),
    );
    expect(scanner).toBeNull();
  });

  it('builds service when expo-camera module resolves', async () => {
    const scanner = await createCameraScanner(async () => fakeCameraModule);
    if (!scanner) throw new Error('expected scanner');

    expect(typeof scanner.start).toBe('function');
    expect(typeof scanner.stop).toBe('function');
    expect(typeof scanner.subscribe).toBe('function');

    const seen: ScanResult[] = [];
    scanner.subscribe((r) => seen.push(r));
    await scanner.start({ acceptedFormats: ['qr'], duplicateWindowMs: 60_000 });
    scanner.ingest('EMP001', 'qr');
    expect(seen).toHaveLength(1);
    await scanner.stop();
  });
});
