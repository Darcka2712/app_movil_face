import type { HttpClient } from '@face/api-client';

/**
 * Backend: DeviceAsistenciaService.getEmpleados → EmpleadoRepository.findEmpleadosByAsignacion
 * SELECT id_empleado, nombre, apellido_paterno, apellido_materno, codigo_empleado.
 * Controller wraps { success, data }; HttpClient unwraps envelope.
 */
export interface EmpleadoMin {
  id_empleado: number;
  nombre: string;
  apellido_paterno: string;
  apellido_materno: string | null;
  codigo_empleado: string;
}

export function listEmpleados(client: HttpClient): Promise<EmpleadoMin[]> {
  return client.get<EmpleadoMin[]>('/device/empleados', { device: true });
}
