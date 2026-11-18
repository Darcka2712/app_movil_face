import { migrate } from '../migrate';
import { createMemoryDatabase } from '../memory-database';

describe('migrate', () => {
  it('applies 001_init and records it in schema_migrations', async () => {
    const db = createMemoryDatabase();
    const applied = await migrate(db);
    expect(applied).toEqual(['001_init']);
    const rows = await db.select<{ id: string; applied_at: string }>('schema_migrations');
    expect(rows.map((r) => r.id)).toEqual(['001_init']);
    expect(rows[0]?.applied_at).toEqual(expect.any(String));
  });

  it('creates schema tables', async () => {
    const db = createMemoryDatabase();
    await migrate(db);
    await expect(db.select('attendance_events')).resolves.toEqual([]);
    await expect(db.select('sync_queue')).resolves.toEqual([]);
    await expect(db.select('employees_cache')).resolves.toEqual([]);
    await expect(db.select('device_config')).resolves.toEqual([]);
  });

  it('re-run skips applied migrations (idempotent)', async () => {
    const db = createMemoryDatabase();
    await migrate(db);
    const again = await migrate(db);
    expect(again).toEqual([]);
    const rows = await db.select<{ id: string }>('schema_migrations');
    expect(rows).toHaveLength(1);
  });
});
