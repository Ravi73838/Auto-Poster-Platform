import { describe, it, expect, vi } from 'vitest';
import { HealthService } from '../service.js';
import type { HealthRepository } from '../repository.js';

describe('HealthService', () => {
  it('returns ok status when database and redis are connected', async () => {
    const mockRepo: HealthRepository = {
      checkServices: vi.fn().mockResolvedValue({
        database: 'connected',
        redis: 'connected',
      }),
    };

    const service = new HealthService(mockRepo);
    const health = await service.getHealthStatus();

    expect(health.status).toBe('ok');
    expect(health.services.database).toBe('connected');
    expect(health.services.redis).toBe('connected');
  });

  it('returns degraded status when a service is disconnected', async () => {
    const mockRepo: HealthRepository = {
      checkServices: vi.fn().mockResolvedValue({
        database: 'disconnected',
        redis: 'connected',
      }),
    };

    const service = new HealthService(mockRepo);
    const health = await service.getHealthStatus();

    expect(health.status).toBe('degraded');
  });
});

