import type { HealthRepository } from './repository.js';
import type { HealthResponse } from './types.js';

export class HealthService {
  constructor(private readonly repo: HealthRepository) {}

  async getHealthStatus(): Promise<HealthResponse> {
    const services = await this.repo.checkServices();
    const isOk = services.database === 'connected' && services.redis === 'connected';

    return {
      status: isOk ? 'ok' : 'degraded',
      version: '0.1.0',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      services,
    };
  }
}

