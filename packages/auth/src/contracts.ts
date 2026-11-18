import type { HttpClient } from '@face/api-client';

export interface LoginRequest {
  user: string;
  password: string;
}

export interface LoginUser {
  id: number;
  nombre: string;
  usuario: string;
  email: string;
  rol: string;
  id_rol: number | null;
  nivel_acceso: string;
  tipo_usuario: string;
  id_corporativo: number | null;
  arbol_permisos?: unknown;
}

export interface LoginData {
  message: string;
  rol?: string;
  user: LoginUser;
  token: string;
}

export async function login(
  client: HttpClient,
  req: LoginRequest,
  onToken: (token: string) => Promise<void>,
): Promise<LoginData> {
  const data = await client.post<LoginData>('/usuarios/login', req);
  await onToken(data.token);
  return data;
}

export async function fetchMe(client: HttpClient): Promise<LoginUser> {
  return client.get<LoginUser>('/usuarios/me', { auth: true });
}

export async function logoutRequest(client: HttpClient): Promise<void> {
  await client.post<unknown>('/usuarios/logout', undefined, { auth: true });
}
