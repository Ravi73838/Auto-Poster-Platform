import { Router } from 'express';
import { PublicController } from './public.controller.js';

export function createPublicRouter(): Router {
  const router = Router();

  router.get('/app-config', PublicController.getAppConfig);
  router.get('/environment', PublicController.getEnvironment);

  return router;
}

