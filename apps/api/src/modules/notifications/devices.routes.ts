import { Router } from 'express';
import { requireAuth } from '../../shared/middleware/auth.js';
import { NotificationsController } from './notifications.controller.js';

export function createDevicesRouter(): Router {
  const router = Router();

  router.use(requireAuth);

  router.post('/', NotificationsController.registerDevice);
  router.delete('/:token', NotificationsController.unregisterDevice);

  return router;
}

