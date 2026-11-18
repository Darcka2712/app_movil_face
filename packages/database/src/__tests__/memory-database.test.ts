import { migrate } from '../migrate';
import { createMemoryDatabase } from '../memory-database';
import type { Database } from '../types';

function eventRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    event_id: 'evt-1',
    employee_id: 42,
    codigo: 'EMP042',
    device_id: 'kiosk-1',
    event_type: 'ENTRY',
    occurred_at: '2026-11-18T08:00:00.000Z',
    sync_status: 'PENDING',
    attempt_count: 0,
    last_error: null,
    created_at: '2026-11-18T08:00:00.000Z',
    ...overrides,
  };
}

describe('MemoryDatabase', () => {
  let db: Database;

  beforeEach(async () => {
    db = createMemoryDatabase();
    await migrate(db);
  });

  it('inserts and selects attendance_events', async () => {
    await db.insert('attendance_events', eventRow());
    const rows = await db.select<Record<string, unknown>>('attendance_events');
    expect(rows).toHaveLength(1);
    expect(rows[0]?.event_id).toBe('evt-1');
  });

  it('selects with exact-match where', async () => {
    await db.insert('attendance_events', eventRow());
    await db.insert('attendance_events', eventRow({ event_id: 'evt-2', sync_status: 'SYNCED' }));
    const pending = await db.select<{ event_id: string }>('attendance_events', {
      sync_status: 'PENDING',
    });
    expect(pending.map((r) => r.event_id)).toEqual(['evt-1']);
    const none = await db.select('attendance_events', { sync_status: 'NOPE' });
    expect(none).toEqual([]);
  });

  it('updates matching rows and returns change count', async () => {
    await db.insert('attendance_events', eventRow());
    const changes = await db.update(
      'attendance_events',
      { event_id: 'evt-1' },
      { sync_status: 'SYNCED', attempt_count: 1 },
    );
    expect(changes).toBe(1);
    const rows = await db.select<{ sync_status: string; attempt_count: number }>(
      'attendance_events',
      { event_id: 'evt-1' },
    );
    expect(rows[0]).toMatchObject({ sync_status: 'SYNCED', attempt_count: 1 });
    const miss = await db.update('attendance_events', { event_id: 'nope' }, { sync_status: 'X' });
    expect(miss).toBe(0);
  });

  it('deletes matching rows and returns change count', async () => {
    await db.insert('attendance_events', eventRow());
    expect(await db.delete('attendance_events', { event_id: 'nope' })).toBe(0);
    expect(await db.delete('attendance_events', { event_id: 'evt-1' })).toBe(1);
    await expect(db.select('attendance_events')).resolves.toEqual([]);
  });

  it('rejects duplicate primary key', async () => {
    await db.insert('attendance_events', eventRow());
    await expect(db.insert('attendance_events', eventRow())).rejects.toThrow(/duplicate primary key/);
  });

  it('transaction returns function result', async () => {
    const result = await db.transaction(async () => {
      await db.insert('attendance_events', eventRow());
      await db.insert('device_config', { key: 'device_id', value: 'kiosk-1' });
      return 'done';
    });
    expect(result).toBe('done');
    await expect(db.select('attendance_events')).resolves.toHaveLength(1);
    await expect(db.select('device_config')).resolves.toHaveLength(1);
  });

  it('throws after close', async () => {
    await db.close();
    await expect(db.select('attendance_events')).rejects.toThrow(/closed/);
  });
});
