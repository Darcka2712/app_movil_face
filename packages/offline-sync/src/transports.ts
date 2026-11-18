import { HttpClient, HttpError } from '@face/api-client';
import type { AttendanceEvent, SyncResult, SyncTransport } from './types';

export function createProposedBatchTransport(
  client: HttpClient,
  deviceId: string,
): SyncTransport {
  return {
    async sendBatch(events: AttendanceEvent[]): Promise<SyncResult[]> {
      const data = await client.post<{ results: SyncResult[] }>(
        '/device/sync',
        {
          events: events.map((e) => ({
            eventId: e.eventId,
            employeeId: e.employeeId,
            eventType: e.eventType,
            occurredAt: e.occurredAt,
            deviceId,
          })),
        },
        { device: true },
      );
      return data.results;
    },
  };
}

// shortcut: no server-side eventId dedupe — timeout retry may duplicate;
// upgrade to createProposedBatchTransport when backend P7 (/device/sync) lands
export function createSingleEventTransport(
  client: HttpClient,
  deviceId: string,
): SyncTransport {
  void deviceId; // X-Device-Key header carries device identity on device routes
  return {
    async sendBatch(events: AttendanceEvent[]): Promise<SyncResult[]> {
      const results: SyncResult[] = [];
      for (const event of events) {
        const path = event.eventType === 'ENTRY' ? '/device/entrada' : '/device/salida';
        const body =
          event.codigo !== null
            ? { codigo: event.codigo, timestamp: event.occurredAt }
            : { id_empleado: event.employeeId, timestamp: event.occurredAt };
        try {
          await client.post(path, body, { device: true });
          results.push({ eventId: event.eventId, status: 'SYNCED' });
        } catch (err) {
          if (err instanceof HttpError && err.status >= 400 && err.status < 500) {
            results.push({
              eventId: event.eventId,
              status: 'REJECTED',
              errorCode: err.code,
              message: err.message,
            });
            continue;
          }
          throw err;
        }
      }
      return results;
    },
  };
}
