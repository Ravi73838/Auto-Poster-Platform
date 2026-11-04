import type { Request, Response, NextFunction } from 'express';
import type { ApiSuccessResponse } from '@ap/shared-types';
import type { HealthService } from './service.js';
import type { HealthResponse } from './types.js';

export class HealthController {
  constructor(private readonly service: HealthService) {}

  getHealth = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = await this.service.getHealthStatus();
      const response: ApiSuccessResponse<HealthResponse> = {
        success: true,
        data,
      };
      res.status(200).json(response);
    } catch (err) {
      next(err);
    }
  };

  getReadiness = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = await this.service.getHealthStatus();
      const isReady = data.services.database === 'connected' && data.services.redis === 'connected';

      if (isReady) {
        res.status(200).json({
          success: true,
          data: {
            status: 'ready',
            checks: {
              database: 'ok',
              redis: 'ok',
            },
          },
        });
      } else {
        res.status(503).json({
          success: false,
          error: {
            code: 'INTERNAL_ERROR',
            message: 'Service dependencies are not ready',
          },
          data: {
            status: 'not_ready',
            checks: {
              database: data.services.database === 'connected' ? 'ok' : 'down',
              redis: data.services.redis === 'connected' ? 'ok' : 'down',
            },
          },
        });
      }
    } catch (err) {
      next(err);
    }
  };
}
