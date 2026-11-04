import { Router } from 'express';
import { requireAuth } from '../../shared/middleware/auth.js';
import { NotificationsController } from './notifications.controller.js';

export function createMeNotificationsRouter(): Router {
  const router = Router();

  router.use(requireAuth);

  router.get('/notification-preferences', NotificationsController.getPreferences);
  router.put('/notification-preferences', NotificationsController.updatePreferences);
  router.get('/notification-settings', NotificationsController.getSettings);
  router.put('/notification-settings', NotificationsController.updateSettings);

  return router;
}

