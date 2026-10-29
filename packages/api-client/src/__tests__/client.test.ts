import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ApiClient, ApiError } from '../client.js';
import { ERROR_CODES, LANGUAGES } from '@ap/shared-constants';

describe('ApiClient', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('unwraps successful responses', async () => {
    const mockHealth = {
      status: 'ok',
      version: '0.1.0',
      timestamp: new Date().toISOString(),
      uptime: 100,
      services: { database: 'connected', redis: 'connected' },
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
});
