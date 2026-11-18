import { localDateKey, type SyncEngine } from '@face/offline-sync';
import type { EmployeeCache } from './employeeCache';

export type AttendanceOutcome =
  | { ok: true; eventId: string; eventType: 'ENTRY' | 'EXIT' }
  | {
      ok: false;
      code: 'UNKNOWN_EMPLOYEE' | 'DAY_CLOSED' | 'NO_DEVICE_KEY' | 'ENQUEUE_FAILED';
      message: string;
    };

export interface AttendanceDeps {
  cache: EmployeeCache;
  engine: SyncEngine;
  now: () => Date;
}

export async function recordAttendance(
  deps: AttendanceDeps,
  rawCodigo: string,
): Promise<AttendanceOutcome> {
  const codigo = rawCodigo.trim().toUpperCase();
  const employee = codigo ? await deps.cache.findByCodigo(codigo) : null;
  if (!employee) {
    return {
      ok: false,
      code: 'UNKNOWN_EMPLOYEE',
      message: 'Código de empleado no reconocido',
    };
  }

  const now = deps.now();
  const dayKey = localDateKey(now);
  const events = await deps.engine.findForEmployeeDay(employee.id_empleado, dayKey);
  const hasEntry = events.some((e) => e.eventType === 'ENTRY');
  const hasExit = events.some((e) => e.eventType === 'EXIT');

  if (hasExit) {
    return {
      ok: false,
      code: 'DAY_CLOSED',
      message: 'El día ya está cerrado para este empleado',
    };
  }

  const eventType: 'ENTRY' | 'EXIT' = hasEntry ? 'EXIT' : 'ENTRY';
  const eventId = crypto.randomUUID();
  try {
    // persist-before-confirm: enqueue awaits db, caller only sees ok after write
    await deps.engine.enqueue({
      eventId,
      employeeId: employee.id_empleado,
      codigo,
      deviceId: 'kiosk',
      eventType,
      occurredAt: now.toISOString(),
    });
  } catch {
    return {
      ok: false,
      code: 'ENQUEUE_FAILED',
      message: 'No se pudo guardar el registro en el dispositivo',
    };
  }

  return { ok: true, eventId, eventType };
}
