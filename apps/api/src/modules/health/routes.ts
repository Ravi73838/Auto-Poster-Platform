import { Router } from 'express';
import { HealthRepository } from './repository.js';
import { HealthService } from './service.js';
import { HealthController } from './controller.js';

export function createHealthRouter(): Router {
  const router = Router();
  const repo = new HealthRepository();
  const service = new HealthService(repo);
  const controller = new HealthController(service);

  router.get('/', controller.getHealth);

  return router;
}
