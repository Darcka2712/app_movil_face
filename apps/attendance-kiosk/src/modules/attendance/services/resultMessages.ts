import type { AttendanceOutcome } from './attendanceUsecase';

export type AttendanceFailureCode = Extract<
  AttendanceOutcome,
  { ok: false }
>['code'];

const FAILURE_MESSAGES: Record<AttendanceFailureCode, string> = {
  UNKNOWN_EMPLOYEE: 'Codigo no encontrado',
  DAY_CLOSED: 'Jornada cerrada hoy',
  ENQUEUE_FAILED: 'No se pudo guardar — intente de nuevo',
  NO_DEVICE_KEY: 'Dispositivo no provisionado',
};

export function resultMessage(code: AttendanceFailureCode): string {
  return FAILURE_MESSAGES[code];
}

export function successMessage(eventType: 'ENTRY' | 'EXIT'): string {
  return `Guardado en dispositivo — ${eventType === 'ENTRY' ? 'Entrada' : 'Salida'}`;
}
