import type { Database } from './types';

interface ExpoSqliteModule {
  openDatabaseAsync(name: string): Promise<ExpoSqliteDatabase>;
}

interface ExpoSqliteDatabase {
  execAsync(sql: string): Promise<void>;
  getAllAsync<T>(sql: string, params: unknown[]): Promise<T[]>;
  runAsync(sql: string, params: unknown[]): Promise<{ changes: number }>;
  withTransactionAsync(fn: () => Promise<void>): Promise<void>;
  closeAsync(): Promise<void>;
}

function buildWhere(where: Record<string, unknown>): { clause: string; params: unknown[] } {
  const cols = Object.keys(where);
  if (cols.length === 0) return { clause: '', params: [] };
  return {
    clause: ` WHERE ${cols.map((col) => `${col} = ?`).join(' AND ')}`,
    params: cols.map((col) => where[col]),
  };
}

// shortcut: expo-sqlite is an optional peer loaded via non-literal dynamic
// import so typecheck passes without it installed; verify method signatures
// against the installed expo-sqlite version when wiring the kiosk (Task 5).
export async function createExpoDatabase(name = 'face.db'): Promise<Database> {
  const moduleName = 'expo-sqlite';
  const sqlite = (await import(moduleName)) as ExpoSqliteModule;
  const db = await sqlite.openDatabaseAsync(name);

  return {
    async exec(sql: string): Promise<void> {
      await db.execAsync(sql);
    },

    async select<T>(tableName: string, where?: Record<string, unknown>): Promise<T[]> {
      const { clause, params } = where ? buildWhere(where) : { clause: '', params: [] };
      return db.getAllAsync<T>(`SELECT * FROM ${tableName}${clause}`, params);
    },

    async insert(tableName: string, row: Record<string, unknown>): Promise<void> {
      const cols = Object.keys(row);
      const placeholders = cols.map(() => '?').join(', ');
      await db.runAsync(
        `INSERT INTO ${tableName} (${cols.join(', ')}) VALUES (${placeholders})`,
        cols.map((col) => row[col]),
      );
    },

    async update(
      tableName: string,
      where: Record<string, unknown>,
      patch: Record<string, unknown>,
    ): Promise<number> {
      const patchCols = Object.keys(patch);
      const { clause, params: whereParams } = buildWhere(where);
      const setClause = patchCols.map((col) => `${col} = ?`).join(', ');
      const result = await db.runAsync(
        `UPDATE ${tableName} SET ${setClause}${clause}`,
        [...patchCols.map((col) => patch[col]), ...whereParams],
      );
      return result.changes;
    },

    async delete(tableName: string, where: Record<string, unknown>): Promise<number> {
      const { clause, params } = buildWhere(where);
      const result = await db.runAsync(`DELETE FROM ${tableName}${clause}`, params);
      return result.changes;
    },

    async transaction<T>(fn: () => Promise<T>): Promise<T> {
      let result: T | undefined;
      await db.withTransactionAsync(async () => {
        result = await fn();
      });
      return result as T;
    },

    async close(): Promise<void> {
      await db.closeAsync();
    },
  };
}
