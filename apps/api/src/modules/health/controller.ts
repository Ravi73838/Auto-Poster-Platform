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
}
