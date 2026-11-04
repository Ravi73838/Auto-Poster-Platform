import { Router } from 'express';
import { requireAuth, requireRole } from '../../shared/middleware/auth.js';
import { ROLES } from '@ap/shared-constants';
import { DisputesController } from './disputes.controller.js';

export function createCompanyDisputesRouter(): Router {
  const router = Router();

  router.use(requireAuth);
  router.use(requireRole(ROLES.COMPANY));

  router.post('/', DisputesController.createCompanyDispute);
  router.get('/', DisputesController.list);
  router.get('/:id', DisputesController.getDetail);
  router.post('/:id/messages', DisputesController.addMessage);
  router.post('/:id/evidence', DisputesController.addEvidence);
  router.post('/:id/reopen-request', DisputesController.requestReopen);

  return router;
}

