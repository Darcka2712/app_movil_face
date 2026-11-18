import { getHttpClient, whenDeviceKeyReady } from '../../../config/client';
import { recordAttendance, type AttendanceOutcome } from './attendanceUsecase';
import { EmployeeCache, syncEmployeeCache } from './employeeCache';
import { getKioskSyncRuntime, type SyncRuntime } from './syncRuntime';

export interface AttendanceRuntime {
  record(codigo: string): Promise<AttendanceOutcome>;
}

export function createAttendanceRuntime(sync: SyncRuntime): AttendanceRuntime {
  const cache = new EmployeeCache(sync.database);
  return {
    record: (codigo: string) =>
      recordAttendance(
        { cache, engine: sync.engine, now: () => new Date() },
        codigo,
      ),
  };
}

let runtimePromise: Promise<AttendanceRuntime> | null = null;

export function getKioskAttendanceRuntime(): Promise<AttendanceRuntime> {
  if (!runtimePromise) {
    runtimePromise = (async () => {
      await whenDeviceKeyReady();
      const sync = await getKioskSyncRuntime();
      // best-effort boot sync: offline boot stays empty until refreshEmployeeCache
      void syncEmployeeCache(getHttpClient(), sync.database).catch(() => {});
      return createAttendanceRuntime(sync);
    })();
  }
  return runtimePromise;
}

export async function refreshEmployeeCache(): Promise<number> {
  const sync = await getKioskSyncRuntime();
  return syncEmployeeCache(getHttpClient(), sync.database);
}
