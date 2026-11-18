import { createMemoryDatabase } from '@face/database';
import type { Database } from '@face/database';
import { createSyncQueue } from '../sync-queue';
import type { SyncQueue } from '../types';

async function setup(): Promise<{ db: Database; queue: SyncQueue }> {
  const db = createMemoryDatabase();
  await db.exec(`CREATE TABLE IF NOT EXISTS sync_queue (
    event_id TEXT PRIMARY KEY,
    next_attempt_at TEXT NOT NULL,
    locked_at TEXT,
    updated_at TEXT NOT NULL
  );`);
  return { db, queue: createSyncQueue(db) };
}

describe('SyncQueue', () => {
  it('enqueue stores item unlocked', async () => {
    const { queue, db } = await setup();
    await queue.enqueue('e1', '2026-11-18T10:00:00.000Z');
    const rows = await db.select<{ event_id: string; locked_at: string | null }>('sync_queue');
    expect(rows).toHaveLength(1);
    expect(rows[0]?.event_id).toBe('e1');
    expect(rows[0]?.locked_at ?? null).toBeNull();
  });

  it('claimDue returns only due + unlocked items, ordered by next_attempt_at', async () => {
    const { queue } = await setup();
    await queue.enqueue('later', '2026-11-18T12:00:00.000Z');
    await queue.enqueue('due_b', '2026-11-18T09:30:00.000Z');
    await queue.enqueue('due_a', '2026-11-18T09:00:00.000Z');
    const now = '2026-11-18T10:00:00.000Z';
    const claimed = await queue.claimDue(now, 10);
    expect(claimed.map((i) => i.eventId)).toEqual(['due_a', 'due_b']);
  });

  it('claimDue skips locked items and respects limit', async () => {
    const { queue } = await setup();
    await queue.enqueue('a', '2026-11-18T09:00:00.000Z');
    await queue.enqueue('b', '2026-11-18T09:01:00.000Z');
    await queue.enqueue('c', '2026-11-18T09:02:00.000Z');
    const first = await queue.claimDue('2026-11-18T10:00:00.000Z', 2);
    expect(first).toHaveLength(2);
    const second = await queue.claimDue('2026-11-18T10:00:00.000Z', 10);
    expect(second.map((i) => i.eventId)).toEqual(['c']);
  });

  it('claim sets locked_at to now on returned items and in storage', async () => {
    const { queue, db } = await setup();
    await queue.enqueue('e1', '2026-11-18T09:00:00.000Z');
    const now = '2026-11-18T10:00:00.000Z';
    const claimed = await queue.claimDue(now, 10);
    expect(claimed[0]?.lockedAt).toBe(now);
    const rows = await db.select<{ locked_at: string | null }>('sync_queue');
    expect(rows[0]?.locked_at).toBe(now);
  });

  it('reschedule updates next_attempt_at and clears lock', async () => {
    const { queue, db } = await setup();
    await queue.enqueue('e1', '2026-11-18T09:00:00.000Z');
    await queue.claimDue('2026-11-18T10:00:00.000Z', 10);
    await queue.reschedule('e1', '2026-11-18T11:00:00.000Z');
    const rows = await db.select<{ next_attempt_at: string; locked_at: string | null }>('sync_queue');
    expect(rows[0]?.next_attempt_at).toBe('2026-11-18T11:00:00.000Z');
    expect(rows[0]?.locked_at ?? null).toBeNull();
  });

  it('release clears lock only', async () => {
    const { queue, db } = await setup();
    await queue.enqueue('e1', '2026-11-18T09:00:00.000Z');
    await queue.claimDue('2026-11-18T10:00:00.000Z', 10);
    await queue.release('e1');
    const rows = await db.select<{ next_attempt_at: string; locked_at: string | null }>('sync_queue');
    expect(rows[0]?.next_attempt_at).toBe('2026-11-18T09:00:00.000Z');
    expect(rows[0]?.locked_at ?? null).toBeNull();
  });

  it('remove deletes the item', async () => {
    const { queue, db } = await setup();
    await queue.enqueue('e1', '2026-11-18T09:00:00.000Z');
    await queue.remove('e1');
    const rows = await db.select('sync_queue');
    expect(rows).toHaveLength(0);
  });
});
