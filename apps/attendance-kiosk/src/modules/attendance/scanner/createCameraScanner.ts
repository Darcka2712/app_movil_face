import { createDedupeFilter } from '@face/scanner';
import type { ScanResult, ScannerConfig, ScannerService } from '@face/scanner';

// Typed as plain string so tsc never resolves 'expo-camera' (not installed until P6 device).
const EXPO_CAMERA: string = 'expo-camera';

export interface CameraScannerService extends ScannerService {
  /** Feed a barcode event (CameraView.onBarcodeScanned) into subscribers. */
  ingest(value: string, format: string): void;
}

export function buildCameraScanner(cam: unknown): CameraScannerService | null {
  const mod = cam as { CameraView?: unknown } | null | undefined;
  if (!mod || mod.CameraView == null) return null;

  const listeners = new Set<(r: ScanResult) => void>();
  let config: ScannerConfig | null = null;
  let filter: ((result: ScanResult) => boolean) | null = null;

  return {
    async start(next: ScannerConfig) {
      config = next;
      filter = createDedupeFilter(next.duplicateWindowMs);
    },
    async stop() {
      config = null;
      filter = null;
    },
    subscribe(callback) {
      listeners.add(callback);
      return () => listeners.delete(callback);
    },
    // shortcut: app never renders CameraView until expo-camera ships (P6 device); ingest runs only in tests until then
    ingest(value: string, format: string) {
      if (!config || !filter || !config.acceptedFormats.includes(format)) return;
      const result: ScanResult = {
        value,
        format,
        source: 'camera',
        scannedAt: new Date().toISOString(),
      };
      if (!filter(result)) return;
      for (const cb of listeners) cb(result);
    },
  };
}

export type CameraModuleLoader = () => Promise<unknown>;

export async function createCameraScanner(
  load: CameraModuleLoader = () => import(EXPO_CAMERA),
): Promise<CameraScannerService | null> {
  try {
    return buildCameraScanner(await load());
  } catch {
    return null;
  }
}
