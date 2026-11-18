import { HttpClient, NetworkError } from '@face/api-client';
import { createProposedBatchTransport, createSingleEventTransport } from '../transports';
import type { AttendanceEvent } from '../types';

const originalFetch = global.fetch;

function makeEvent(overrides: Partial<AttendanceEvent> = {}): AttendanceEvent {
  return {
    eventId: 'evt_1',
    employeeId: 42,
    codigo: 'A123',
    deviceId: 'dev_1',
    eventType: 'ENTRY',
    occurredAt: '2026-11-18T09:59:00.000Z',
    syncStatus: 'PENDING',
    attemptCount: 0,
    ...overrides,
  };
}

function client(): HttpClient {
  return new HttpClient({
    baseUrl: 'http://x/api/v1',
    getDeviceKey: () => 'dk_test',
  });
}

function jsonResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as unknown as Response;
}

afterEach(() => {
  global.fetch = originalFetch;
});

describe('createProposedBatchTransport', () => {
  it('POSTs /device/sync with X-Device-Key, maps events and results', async () => {
    const mockFetch = jest.fn().mockResolvedValue(
      jsonResponse(200, {
        success: true,
        data: {
          results: [
            { eventId: 'evt_1', status: 'SYNCED', serverRecordId: 7 },
            { eventId: 'evt_2', status: 'DUPLICATE' },
          ],
        },
      }),
    );
    global.fetch = mockFetch as unknown as typeof fetch;
    const transport = createProposedBatchTransport(client(), 'dev_1');

    const results = await transport.sendBatch([
      makeEvent(),
      makeEvent({ eventId: 'evt_2', eventType: 'EXIT' }),
    ]);

    const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('http://x/api/v1/device/sync');
    expect(init.method).toBe('POST');
    expect((init.headers as Record<string, string>)['X-Device-Key']).toBe('dk_test');
    expect(JSON.parse(init.body as string)).toEqual({
      events: [
        {
          eventId: 'evt_1',
          employeeId: 42,
          eventType: 'ENTRY',
          occurredAt: '2026-11-18T09:59:00.000Z',
          deviceId: 'dev_1',
        },
        {
          eventId: 'evt_2',
          employeeId: 42,
          eventType: 'EXIT',
          occurredAt: '2026-11-18T09:59:00.000Z',
          deviceId: 'dev_1',
        },
      ],
    });
    expect(results).toEqual([
      { eventId: 'evt_1', status: 'SYNCED', serverRecordId: 7 },
      { eventId: 'evt_2', status: 'DUPLICATE' },
    ]);
  });
});

describe('createSingleEventTransport', () => {
  it('ENTRY posts /device/entrada, EXIT posts /device/salida with codigo/timestamp', async () => {
    const mockFetch = jest
      .fn()
      .mockResolvedValueOnce(jsonResponse(201, { success: true, data: { id: 10 } }))
      .mockResolvedValueOnce(jsonResponse(201, { success: true, data: { id: 11 } }));
    global.fetch = mockFetch as unknown as typeof fetch;
    const transport = createSingleEventTransport(client(), 'dev_1');

    const results = await transport.sendBatch([
      makeEvent({ eventId: 'e1', eventType: 'ENTRY' }),
      makeEvent({ eventId: 'e2', eventType: 'EXIT' }),
    ]);

    expect(results).toEqual([
      { eventId: 'e1', status: 'SYNCED' },
      { eventId: 'e2', status: 'SYNCED' },
    ]);
    const [url1, init1] = mockFetch.mock.calls[0] as [string, RequestInit];
    const [url2, init2] = mockFetch.mock.calls[1] as [string, RequestInit];
    expect(url1).toBe('http://x/api/v1/device/entrada');
    expect(url2).toBe('http://x/api/v1/device/salida');
    expect((init1.headers as Record<string, string>)['X-Device-Key']).toBe('dk_test');
    expect(JSON.parse(init1.body as string)).toEqual({
      codigo: 'A123',
      timestamp: '2026-11-18T09:59:00.000Z',
    });
    expect(JSON.parse(init2.body as string)).toEqual({
      codigo: 'A123',
      timestamp: '2026-11-18T09:59:00.000Z',
    });
  });

  it('uses id_empleado when codigo is null', async () => {
    const mockFetch = jest
      .fn()
      .mockResolvedValueOnce(jsonResponse(201, { success: true, data: { id: 1 } }));
    global.fetch = mockFetch as unknown as typeof fetch;
    const transport = createSingleEventTransport(client(), 'dev_1');

    await transport.sendBatch([makeEvent({ codigo: null, employeeId: 99 })]);

    const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(init.body as string)).toEqual({
      id_empleado: 99,
      timestamp: '2026-11-18T09:59:00.000Z',
    });
  });

  it('HttpError 403 → REJECTED with code, continues batch', async () => {
    const mockFetch = jest
      .fn()
      .mockResolvedValueOnce(
        jsonResponse(403, { success: false, error: 'FORBIDDEN', message: 'Sin permiso' }),
      )
      .mockResolvedValueOnce(jsonResponse(201, { success: true, data: { id: 2 } }));
    global.fetch = mockFetch as unknown as typeof fetch;
    const transport = createSingleEventTransport(client(), 'dev_1');

    const results = await transport.sendBatch([
      makeEvent({ eventId: 'e1' }),
      makeEvent({ eventId: 'e2' }),
    ]);

    expect(results).toEqual([
      { eventId: 'e1', status: 'REJECTED', errorCode: 'FORBIDDEN', message: 'Sin permiso' },
      { eventId: 'e2', status: 'SYNCED' },
    ]);
  });

  it('NetworkError propagates to engine (rethrow)', async () => {
    global.fetch = jest.fn().mockRejectedValue(new TypeError('Failed to fetch')) as unknown as typeof fetch;
    const transport = createSingleEventTransport(client(), 'dev_1');

    await expect(transport.sendBatch([makeEvent()])).rejects.toBeInstanceOf(NetworkError);
  });
});
