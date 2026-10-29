import type { HealthResponse } from '@ap/shared-types';

export type { HealthResponse };

export interface SystemHealthCheckResult {
  database: 'connected' | 'disconnected' | 'disabled';
  redis: 'connected' | 'disconnected' | 'disabled';
}
