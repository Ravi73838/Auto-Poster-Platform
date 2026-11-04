import { Router } from 'express';
import { AdminInstallationsController } from './admin-installations.controller.js';
import { requireAuth, requireRole, requirePermission } from '../../shared/middleware/auth.js';
import { ROLES } from '@ap/shared-constants';

export function createAdminInstallationsRouter(): Router {
  const router = Router();

  router.use(requireAuth());

  // Reviewers (Moderator, Super Admin)
  router.get('/review-queue', requirePermission('campaign.review'), AdminInstallationsController.getReviewQueue);
  router.post('/:id/claim', requirePermission('campaign.review'), AdminInstallationsController.claim);
  router.post('/:id/release', requirePermission('campaign.review'), AdminInstallationsController.release);
  router.post('/:id/decision', requirePermission('campaign.review'), AdminInstallationsController.decide);

  return router;
}

