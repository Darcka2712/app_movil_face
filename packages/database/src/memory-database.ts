import type { Database } from './types';

// shortcut: no NOT NULL/CHECK constraint enforcement and no rollback on
// transaction failure — expo adapter relies on real SQLite for both.
export function createMemoryDatabase(): Database {
  const tables = new Map<string, Map<string, Record<string, unknown>>>();
  const pkColumns = new Map<string, string>();
  let seq = 0;
  let closed = false;

  function ensureOpen(): void {
    if (closed) throw new Error('database is closed');
  }

  function table(name: string): Map<string, Record<string, unknown>> {
    const found = tables.get(name);
    if (!found) throw new Error(`unknown table: ${name}`);
    return found;
  }

  function matches(row: Record<string, unknown>, where: Record<string, unknown>): boolean {
    return Object.entries(where).every(([col, value]) => row[col] === value);
  }

  return {
    async exec(sql: string): Promise<void> {
      ensureOpen();
      const createRe = /CREATE TABLE IF NOT EXISTS (\w+)\s*\(([\s\S]*?)\);/gi;
      let match: RegExpExecArray | null;
      while ((match = createRe.exec(sql)) !== null) {
        const name = match[1];
        const body = match[2];
        if (!name || !body) continue;
        if (!tables.has(name)) tables.set(name, new Map());
        const pk = /(?:^|,)\s*(\w+)\s+[^,]*PRIMARY KEY/i.exec(body)?.[1];
        if (pk) pkColumns.set(name, pk);
      }
    },

    async select<T>(tableName: string, where?: Record<string, unknown>): Promise<T[]> {
      ensureOpen();
      const rows = [...table(tableName).values()];
      const filtered = where ? rows.filter((row) => matches(row, where)) : rows;
      return filtered.map((row) => ({ ...row })) as unknown as T[];
    },

    async insert(tableName: string, row: Record<string, unknown>): Promise<void> {
      ensureOpen();
      const store = table(tableName);
      const pk = pkColumns.get(tableName);
      if (pk) {
        const key = row[pk];
        if (key === undefined || key === null) {
          throw new Error(`missing primary key: ${pk}`);
        }
        const id = String(key);
        if (store.has(id)) throw new Error(`duplicate primary key: ${id}`);
        store.set(id, { ...row });
      } else {
        store.set(`row_${seq++}`, { ...row });
      }
    },

    async update(
      tableName: string,
      where: Record<string, unknown>,
      patch: Record<string, unknown>,
    ): Promise<number> {
      ensureOpen();
      const store = table(tableName);
      let changes = 0;
      for (const [key, row] of store) {
        if (matches(row, where)) {
          store.set(key, { ...row, ...patch });
          changes += 1;
        }
      }
      return changes;
    },

    async delete(tableName: string, where: Record<string, unknown>): Promise<number> {
      ensureOpen();
      const store = table(tableName);
      let changes = 0;
      for (const [key, row] of store) {
        if (matches(row, where)) {
          store.delete(key);
          changes += 1;
        }
      }
      return changes;
    },

    async transaction<T>(fn: () => Promise<T>): Promise<T> {
      ensureOpen();
      return fn();
    },

    async close(): Promise<void> {
      closed = true;
    },
  };
}
