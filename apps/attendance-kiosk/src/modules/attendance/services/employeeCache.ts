import type { HttpClient } from '@face/api-client';
import type { Database } from '@face/database';
import { listEmpleados } from './deviceApi';

export interface EmployeeCacheEntry {
  id_empleado: number;
  codigo_empleado: string;
  nombre: string;
  apellido_paterno: string;
  apellido_materno: string | null;
}

function normalizeCodigo(codigo: string): string {
  return codigo.trim().toUpperCase();
}

export class EmployeeCache {
  constructor(private readonly db: Database) {}

  async refreshFromServer(employees: EmployeeCacheEntry[]): Promise<number> {
    const cachedAt = new Date().toISOString();
    await this.db.transaction(async () => {
      for (const emp of employees) {
        const existing = await this.db.select<Pick<EmployeeCacheEntry, 'id_empleado'>>(
          'employees_cache',
          { id_empleado: emp.id_empleado },
        );
        const row = { ...emp, cached_at: cachedAt };
        if (existing.length > 0) {
          await this.db.update(
            'employees_cache',
            { id_empleado: emp.id_empleado },
            row,
          );
        } else {
          await this.db.insert('employees_cache', row);
        }
      }
    });
    return employees.length;
  }

  async findByCodigo(codigo: string): Promise<EmployeeCacheEntry | null> {
    const target = normalizeCodigo(codigo);
    if (!target) return null;
    const rows = await this.db.select<EmployeeCacheEntry>('employees_cache');
    // where clause is exact-match only; normalize both sides in JS
    return rows.find((row) => normalizeCodigo(row.codigo_empleado ?? '') === target) ?? null;
  }

  async count(): Promise<number> {
    const rows = await this.db.select<unknown>('employees_cache');
    return rows.length;
  }
}

export async function syncEmployeeCache(
  client: HttpClient,
  db: Database,
): Promise<number> {
  const employees = await listEmpleados(client);
  return new EmployeeCache(db).refreshFromServer(employees);
}
