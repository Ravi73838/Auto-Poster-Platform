import { describe, it, expect, vi, beforeAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';
import { ERROR_CODES } from '@ap/shared-constants';

vi.mock('../modules/health/repository.js', () => {
  return {
    HealthRepository: vi.fn().mockImplementation(() => ({
      checkServices: vi.fn().mockResolvedValue({
        database: 'connected',
        redis: 'connected',
      }),
    })),
  };
});

describe('API Integration Endpoints', () => {
  const app = createApp();

  beforeAll(() => {
    process.env.NODE_ENV = 'test';
  });

  it('GET /api/v1/health returns 200 with the success envelope', async () => {
    const res = await request(app).get('/api/v1/health');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      success: true,
      data: {
        status: 'ok',
        version: '0.1.0',
        services: {
          database: 'connected',
          redis: 'connected',
        },
      },
    });
    expect(res.headers['x-request-id']).toBeDefined();
  });

  it('GET unknown route returns a 404 failure envelope', async () => {
    const res = await request(app).get('/api/v1/non-existent-route');
    expect(res.status).toBe(404);
    expect(res.body).toMatchObject({
      success: false,
      error: {
        code: ERROR_CODES.NOT_FOUND,
      },
    });
  });

  it('Thrown AppError returns the failure envelope', async () => {
    const res = await request(app).get('/api/v1/template/nonexistent-item-id');
    expect(res.status).toBe(404);
    expect(res.body).toMatchObject({
      success: false,
      error: {
        code: ERROR_CODES.NOT_FOUND,
        message: 'Item with id nonexistent-item-id not found',
      },
    });
  });
});
