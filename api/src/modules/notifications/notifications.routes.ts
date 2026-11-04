import { Router } from 'express';
import { requireAuth, requireRole } from '../../shared/middleware/auth.js';
import { ROLES } from '@ap/shared-constants';
import { NotificationsController } from './notifications.controller.js';

export function createNotificationsRouter(): Router {
  const router = Router();

  router.use(requireAuth);

  router.get('/', NotificationsController.list);
  router.get('/unread-count', NotificationsController.getUnreadCount);
  router.patch('/:id/read', NotificationsController.markRead);
  router.post('/read-all', NotificationsController.markAllRead);

  router.get('/preferences', NotificationsController.getPreferences);
  router.put('/preferences', NotificationsController.updatePreferences);
  router.get('/settings', NotificationsController.getSettings);
  router.put('/settings', NotificationsController.updateSettings);

  router.get(
    '/stats',
    requireRole(ROLES.SUPER_ADMIN, ROLES.MODERATOR),
    NotificationsController.getStats,
  );

  return router;
}
