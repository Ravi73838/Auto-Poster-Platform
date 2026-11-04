import { Router } from 'express';
import { AdminCampaignsController } from './admin-campaigns.controller.js';
import { requireAuth, requirePermission, requireRole } from '../../shared/middleware/auth.js';
import { ROLES } from '@ap/shared-constants';

export function createAdminCampaignsRouter(): Router {
  const router = Router();

  router.use(requireAuth);

  // List campaigns (Finance, Moderator, Super Admin)
  router.get('/', requirePermission('campaign.view'), AdminCampaignsController.list);

  // Review queue & actions (Moderator, Super Admin)
  router.get('/review-queue', requirePermission('campaign.review'), AdminCampaignsController.getReviewQueue);
  router.post('/claim-next', requirePermission('campaign.review'), AdminCampaignsController.claimNext);
  router.post('/:id/claim', requirePermission('campaign.review'), AdminCampaignsController.claim);
  router.post('/:id/release', requirePermission('campaign.review'), AdminCampaignsController.release);

  // Detail (viewable by Finance as well)
  router.get('/:id', requirePermission('campaign.view'), AdminCampaignsController.getDetail);

  // Decision (Moderator, Super Admin)
  router.post('/:id/decision', requirePermission('campaign.review'), AdminCampaignsController.decide);

  // Super Admin force cancellation
  router.post('/:id/cancel', requireRole(ROLES.SUPER_ADMIN), AdminCampaignsController.cancel);

  return router;
}
