export class ApiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(message: string, status: number, code: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

export class HttpError extends ApiError {
  constructor(message: string, status: number, code: string) {
    super(message, status, code);
    this.name = 'HttpError';
  }
}

export class NetworkError extends ApiError {
  constructor(message: string) {
    super(message, 0, 'NETWORK');
    this.name = 'NetworkError';
  }
}
