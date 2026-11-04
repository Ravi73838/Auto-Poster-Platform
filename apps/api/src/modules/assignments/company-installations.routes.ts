import { Router } from 'express';
import { CompanyInstallationsController } from './company-installations.controller.js';
import { requireAuth, requireRole, requireApproved } from '../../shared/middleware/auth.js';
import { ROLES } from '@ap/shared-constants';

export function createCompanyInstallationsRouter(): Router {
  const router = Router();

  router.use(requireAuth());
  router.use(requireRole(ROLES.COMPANY));
  router.use(requireApproved());

  router.get('/campaigns/:id/installations', CompanyInstallationsController.getCampaignInstallations);
  router.post('/installations/:id/decision', CompanyInstallationsController.decide);

  return router;
}

