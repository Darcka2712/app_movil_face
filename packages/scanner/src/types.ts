export type ScannerSource = 'camera' | 'hid' | 'native';

export interface ScanResult {
  value: string;
  format: string;
  source: ScannerSource;
  scannedAt: string;
}

export interface ScannerConfig {
  acceptedFormats: string[];
  duplicateWindowMs: number;
}

export interface ScannerService {
  start(config: ScannerConfig): Promise<void>;
  stop(): Promise<void>;
  subscribe(callback: (result: ScanResult) => void): () => void;
}
