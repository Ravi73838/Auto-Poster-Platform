import {
  ERROR_CODES,
  DEFAULT_LANGUAGE,
  type ErrorCode,
  type Language,
} from '@ap/shared-constants';
import type { ApiResponse, HealthResponse } from '@ap/shared-types';

export class ApiError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  readonly details?: unknown;

  constructor(code: ErrorCode, message: string, status = 500, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
    this.details = details;
    Object.setPrototypeOf(this, ApiError.prototype);
  }
}

export interface ApiClientConfig {
  baseUrl: string;
  getAuthToken?: () => string | null | Promise<string | null>;
  getLanguage?: () => Language;
}

export class ApiClient {
  private baseUrl: string;
  private getAuthToken?: () => string | null | Promise<string | null>;
  private getLanguage: () => Language;

  constructor(config: ApiClientConfig) {
    this.baseUrl = config.baseUrl.replace(/\/+$/, '');
    this.getAuthToken = config.getAuthToken;
    this.getLanguage = config.getLanguage ?? (() => DEFAULT_LANGUAGE);
  }

  async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.baseUrl}/${path.replace(/^\/+/, '')}`;
    const headers = new Headers(options.headers);

    if (!headers.has('Content-Type') && options.body && typeof options.body === 'string') {
      headers.set('Content-Type', 'application/json');
    }

    if (!headers.has('Accept')) {
      headers.set('Accept', 'application/json');
    }

    const language = this.getLanguage();
    if (language && !headers.has('Accept-Language')) {
      headers.set('Accept-Language', language);
    }

    if (this.getAuthToken) {
      const token = await this.getAuthToken();
      if (token && !headers.has('Authorization')) {
        headers.set('Authorization', `Bearer ${token}`);
      }
    }

    let response: Response;
    try {
      response = await fetch(url, {
        ...options,
        headers,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Network request failed';
      throw new ApiError(ERROR_CODES.INTERNAL_ERROR, msg, 0);
    }

    const contentType = response.headers.get('content-type');
    const isJson = contentType && contentType.includes('application/json');

    if (!isJson) {
      if (!response.ok) {
        throw new ApiError(
          ERROR_CODES.INTERNAL_ERROR,
          `HTTP Error ${response.status}`,
          response.status,
        );
      }
      return (await response.text()) as unknown as T;
    }

    let data: ApiResponse<T>;
    try {
      data = (await response.json()) as ApiResponse<T>;
    } catch (err: unknown) {
      throw new ApiError(
        ERROR_CODES.INTERNAL_ERROR,
        'Invalid JSON response from server',
        response.status,
        err,
      );
    }

    if (!data.success) {
      throw new ApiError(
        data.error.code,
        data.error.message,
        response.status,
        data.error.details,
      );
    }

    return data.data;
  }

  async getHealth(): Promise<HealthResponse> {
    return this.request<HealthResponse>('health', { method: 'GET' });
  }
}
