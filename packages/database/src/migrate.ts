import { migration001 } from './migrations/001_init';
import type { Database, Migration } from './types';

const CREATE_MIGRATIONS_TABLE =
  'CREATE TABLE IF NOT EXISTS schema_migrations (id TEXT PRIMARY KEY, applied_at TEXT NOT NULL);';

export async function migrate(
  db: Database,
  migrations: readonly Migration[] = [migration001],
): Promise<string[]> {
  await db.exec(CREATE_MIGRATIONS_TABLE);
  const applied = await db.select<{ id: string }>('schema_migrations');
  const done = new Set(applied.map((row) => row.id));
  const appliedNow: string[] = [];
  for (const migration of migrations) {
    if (done.has(migration.id)) continue;
    await db.exec(migration.sql);
    await db.insert('schema_migrations', {
      id: migration.id,
      applied_at: new Date().toISOString(),
    });
    appliedNow.push(migration.id);
  }
  return appliedNow;
}
