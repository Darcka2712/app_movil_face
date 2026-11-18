export interface ApiSuccess<T> {
  success: true;
  data: T;
}

export interface ApiError {
  success: false;
  error: string;
  message: string;
  timestamp?: string;
}

export type ApiResponse<T> = ApiSuccess<T> | ApiError;

export type SyncStatus = 'PENDING' | 'SYNCING' | 'SYNCED' | 'REJECTED';
