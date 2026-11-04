import { Router } from 'express';
import { requireAuth, requireRole } from '../../shared/middleware/auth.js';
import { ROLES } from '@ap/shared-constants';
import { AnnouncementsController } from './announcements.controller.js';

export function createAnnouncementsRouter(): Router {
  const router = Router();

  router.use(requireAuth);
  router.use(requireRole(ROLES.SUPER_ADMIN, ROLES.MODERATOR));

  router.post('/', AnnouncementsController.create);
  router.get('/', AnnouncementsController.list);
  router.get('/:id', AnnouncementsController.getById);

  return router;
}

