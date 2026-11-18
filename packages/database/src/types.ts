export interface Database {
  exec(sql: string): Promise<void>;
  select<T>(table: string, where?: Record<string, unknown>): Promise<T[]>;
  insert(table: string, row: Record<string, unknown>): Promise<void>;
  update(
    table: string,
    where: Record<string, unknown>,
    patch: Record<string, unknown>,
  ): Promise<number>;
  delete(table: string, where: Record<string, unknown>): Promise<number>;
  transaction<T>(fn: () => Promise<T>): Promise<T>;
  close(): Promise<void>;
}

export interface Migration {
  id: string;
  sql: string;
}
