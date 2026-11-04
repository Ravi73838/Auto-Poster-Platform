import { Router } from 'express';
import { DriverCampaignsController } from './driver-campaigns.controller.js';
import { requireAuth, requireRole, requireApproved } from '../../shared/middleware/auth.js';
import { ROLES } from '@ap/shared-constants';

export function createDriverCampaignsRouter(): Router {
  const router = Router();

  router.use(requireAuth, requireRole(ROLES.DRIVER), requireApproved());

  router.get('/', DriverCampaignsController.list);
  router.get('/:id', DriverCampaignsController.getDetail);

  return router;
}
