export interface AppEnv {
  environment: 'development' | 'staging' | 'production';
  apiBaseUrl: string;
}

const ALLOWED = new Set(['development', 'staging', 'production']);

export function readEnv(source: Record<string, string | undefined>): AppEnv {
  const environment = source.EXPO_PUBLIC_ENVIRONMENT ?? 'development';
  if (!ALLOWED.has(environment)) {
    throw new Error(`Invalid EXPO_PUBLIC_ENVIRONMENT: ${environment}`);
  }
  const apiBaseUrl = source.EXPO_PUBLIC_API_BASE_URL;
  if (!apiBaseUrl) {
    throw new Error('EXPO_PUBLIC_API_BASE_URL is required');
  }
  if (environment !== 'development' && !apiBaseUrl.startsWith('https://')) {
    throw new Error('apiBaseUrl must use HTTPS outside development');
  }
  return { environment: environment as AppEnv['environment'], apiBaseUrl };
}

export function getEnv(): AppEnv {
  return readEnv(process.env);
}
