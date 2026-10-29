import { Router } from 'express';
import type { ApiSuccessResponse } from '@ap/shared-types';

export function createDriverRouter(): Router {
  const router = Router();

  router.get('/status', (_req, res) => {
    const response: ApiSuccessResponse<{ module: string; ready: boolean }> = {
      success: true,
      data: { module: 'driver', ready: false },
    };
    res.json(response);
  });

  return router;
}
