import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ApiClient, ApiError } from '../client.js';
import { ERROR_CODES, LANGUAGES } from '@ap/shared-constants';

describe('ApiClient', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('unwraps successful responses', async () => {
    const mockHealth = {
      status: 'ok' as const,
      version: '0.1.0',
      timestamp: new Date().toISOString(),
      uptime: 100,
      services: { database: 'connected' as const, redis: 'connected' as const },
    };

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({ success: true, data: mockHealth }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const client = new ApiClient({
      baseUrl: 'http://localhost:4000/api/v1',
      getLanguage: () => LANGUAGES.HI,
    });

    const result = await client.getHealth();
    expect(result).toEqual(mockHealth);
    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:4000/api/v1/health',
      expect.objectContaining({
        headers: expect.any(Headers),
      }),
    );
  });

  it('throws typed ApiError on API error envelope', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({
        success: false,
        error: { code: ERROR_CODES.NOT_FOUND, message: 'Resource not found' },
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const client = new ApiClient({ baseUrl: 'http://localhost:4000/api/v1' });
    await expect(client.request('unknown')).rejects.toThrow(ApiError);
  });

  it('attaches authorization header when token is present', async () => {
    let authHeaderValue: string | null = null;
    const fetchMock = vi.fn().mockImplementation((_url: string, init: RequestInit) => {
      const headers = new Headers(init.headers);
      authHeaderValue = headers.get('Authorization');
      return Promise.resolve({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ success: true, data: { ping: 'ok' } }),
      });
    });
    vi.stubGlobal('fetch', fetchMock);

    const client = new ApiClient({
      baseUrl: 'http://localhost:4000/api/v1',
      getAuthToken: () => 'my-test-access-token',
    });

    await client.request('ping');
    expect(authHeaderValue).toBe('Bearer my-test-access-token');
  });

  it('handles token expiration with single-flight refresh and retries', async () => {
    let callCount = 0;
    let refreshCount = 0;
    let currentToken = 'expired-token';

    const fetchMock = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/auth/refresh')) {
        refreshCount++;
        currentToken = 'new-refreshed-token';
        return Promise.resolve({
          ok: true,
          status: 200,
          headers: new Headers({ 'content-type': 'application/json' }),
          json: async () => ({
            success: true,
            data: { accessToken: 'new-refreshed-token', expiresIn: 900 },
          }),
        });
      }

      callCount++;
      if (currentToken === 'expired-token') {
        return Promise.resolve({
          ok: false,
          status: 401,
          headers: new Headers({ 'content-type': 'application/json' }),
          json: async () => ({
            success: false,
            error: { code: ERROR_CODES.TOKEN_EXPIRED, message: 'Token expired' },
          }),
        });
      }

      return Promise.resolve({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ success: true, data: { secured: true } }),
      });
    });
    vi.stubGlobal('fetch', fetchMock);

    const client = new ApiClient({
      baseUrl: 'http://localhost:4000/api/v1',
      getAuthToken: () => currentToken,
      setAuthToken: (tok) => {
        currentToken = tok ?? '';
      },
    });

    // Make 2 concurrent requests
    const [res1, res2] = await Promise.all([
      client.request<{ secured: boolean }>('protected/a'),
      client.request<{ secured: boolean }>('protected/b'),
    ]);

    expect(res1).toEqual({ secured: true });
    expect(res2).toEqual({ secured: true });
    // Single-flight lock should have performed exactly 1 refresh call
    expect(refreshCount).toBe(1);
    expect(callCount).toBe(4); // 2 initial failures + 2 successful retries
    expect(currentToken).toBe('new-refreshed-token');
  });

  it('invokes onAuthLost when token refresh fails', async () => {
    const onAuthLostMock = vi.fn();
    const fetchMock = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/auth/refresh')) {
        return Promise.resolve({
          ok: false,
          status: 401,
          headers: new Headers({ 'content-type': 'application/json' }),
          json: async () => ({
            success: false,
            error: { code: ERROR_CODES.TOKEN_EXPIRED, message: 'Refresh token expired' },
          }),
        });
      }
      return Promise.resolve({
        ok: false,
        status: 401,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({
          success: false,
          error: { code: ERROR_CODES.TOKEN_EXPIRED, message: 'Token expired' },
        }),
      });
    });
    vi.stubGlobal('fetch', fetchMock);

    const client = new ApiClient({
      baseUrl: 'http://localhost:4000/api/v1',
      getAuthToken: () => 'expired',
      onAuthLost: onAuthLostMock,
    });

    await expect(client.request('protected')).rejects.toThrow(ApiError);
    expect(onAuthLostMock).toHaveBeenCalledTimes(1);
  });
});
