import { HttpError, NetworkError } from './errors';

export interface HttpClientOptions {
  baseUrl: string;
  getAccessToken?: () => string | null;
  getDeviceKey?: () => string | null;
}

export interface RequestOptions extends Omit<RequestInit, 'headers'> {
  headers?: Record<string, string>;
  /** Attach X-Device-Key (device routes) */
  device?: boolean;
  /** Attach Authorization: Bearer (user JWT) */
  auth?: boolean;
}

interface Envelope {
  success?: boolean;
  message?: string;
  error?: string;
  data?: unknown;
  timestamp?: string;
}

export class HttpClient {
  private readonly baseUrl: string;
  private readonly getAccessToken?: () => string | null;
  private readonly getDeviceKey?: () => string | null;

  constructor(opts: HttpClientOptions) {
    this.baseUrl = opts.baseUrl.replace(/\/$/, '');
    this.getAccessToken = opts.getAccessToken;
    this.getDeviceKey = opts.getDeviceKey;
  }

  async request<T>(path: string, options: RequestOptions = {}): Promise<T> {
    const { device, auth, headers = {}, ...rest } = options;
    const url = `${this.baseUrl}${path.startsWith('/') ? path : `/${path}`}`;

    const finalHeaders: Record<string, string> = {
      Accept: 'application/json',
      ...headers,
    };

    if (rest.body !== undefined && !finalHeaders['Content-Type']) {
      finalHeaders['Content-Type'] = 'application/json';
    }

    if (device) {
      const key = this.getDeviceKey?.();
      if (!key) {
        throw new NetworkError('Device key not configured');
      }
      finalHeaders['X-Device-Key'] = key;
    }

    if (auth) {
      const token = this.getAccessToken?.();
      if (token) {
        finalHeaders.Authorization = `Bearer ${token}`;
      }
    }

    let response: Response;
    try {
      response = await fetch(url, { ...rest, headers: finalHeaders });
    } catch {
      throw new NetworkError('Network request failed');
    }

    let body: Envelope | null = null;
    try {
      body = (await response.json()) as Envelope;
    } catch {
      body = null;
    }

    if (!response.ok) {
      const code = body?.error ?? body?.message ?? `HTTP_${response.status}`;
      const message = body?.message ?? `Request failed with status ${response.status}`;
      throw new HttpError(message, response.status, code);
    }

    if (body && body.success === false) {
      const code = body.error ?? 'APP_ERROR';
      throw new HttpError(body.message ?? 'Request failed', response.status, code);
    }

    if (body && 'success' in body) {
      return body.data as T;
    }

    return body as T;
  }

  get<T>(path: string, options?: RequestOptions): Promise<T> {
    return this.request<T>(path, { ...options, method: 'GET' });
  }

  post<T>(path: string, body?: unknown, options?: RequestOptions): Promise<T> {
    return this.request<T>(path, {
      ...options,
      method: 'POST',
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  }
}
