import type { HttpClient } from '@face/api-client';
import {
  createMemoryDatabase,
  migrate,
  type Database,
} from '@face/database';
import {
  SyncEngine,
  createAttendanceRepository,
  createMemoryConnectivity,
  createSingleEventTransport,
  createSyncQueue,
  type Connectivity,
} from '@face/offline-sync';
import { getHttpClient } from '../../../config/client';

export interface SyncRuntime {
  engine: SyncEngine;
  getPendingCount(): Promise<number>;
  syncNow(): Promise<void>;
}

export interface SyncRuntimeOptions {
  client: HttpClient;
  deviceId: string;
  database: Database;
  connectivity: Connectivity;
}

export function createSyncRuntime(opts: SyncRuntimeOptions): SyncRuntime {
  const repo = createAttendanceRepository(opts.database);
  const queue = createSyncQueue(opts.database);
  const transport = createSingleEventTransport(opts.client, opts.deviceId);
  const engine = new SyncEngine(
    repo,
    queue,
    transport,
    () => new Date().toISOString(),
    opts.database,
  );
  return {
    engine,
    getPendingCount: () => engine.getPendingCount(),
    async syncNow(): Promise<void> {
      if (!(await opts.connectivity.isOnline())) return;
      try {
        await engine.syncPending();
      } catch {
        // transient failure: events stay queued, callers must not crash
      }
    },
  };
}

let runtimePromise: Promise<SyncRuntime> | null = null;

// TODO(P6): swap MemoryDatabase/createMemoryConnectivity for
// createExpoDatabase/createNetInfoConnectivity once a device is available.
// deviceId is ignored by SingleEventTransport (X-Device-Key carries identity);
// real device id lands with device provisioning.
export function getKioskSyncRuntime(): Promise<SyncRuntime> {
  if (!runtimePromise) {
    runtimePromise = (async () => {
      const database = createMemoryDatabase();
      await migrate(database);
      return createSyncRuntime({
        client: getHttpClient(),
        deviceId: 'kiosk',
        database,
        connectivity: createMemoryConnectivity(true),
      });
    })();
  }
  return runtimePromise;
}
