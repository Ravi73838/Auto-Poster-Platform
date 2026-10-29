import type { ErrorCode, Role, AccountStatus } from '@ap/shared-constants';

export interface ApiSuccessResponse<T> {
  success: true;
  data: T;
  meta?: Record<string, unknown>;
}

export interface ApiErrorDetail {
  code: ErrorCode;
  message: string;
  details?: unknown;
}

export interface ApiFailureResponse {
  success: false;
  error: ApiErrorDetail;
}

export type ApiResponse<T> = ApiSuccessResponse<T> | ApiFailureResponse;

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

export interface HealthResponse {
  status: 'ok' | 'degraded';
  version: string;
  timestamp: string;
  uptime: number;
  services: {
    database: 'connected' | 'disconnected' | 'disabled';
    redis: 'connected' | 'disconnected' | 'disabled';
  };
}

export interface AuthUser {
  id: string;
  role: Role;
  status: AccountStatus;
  name: string;
  phone: string;
}
