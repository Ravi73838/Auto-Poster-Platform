import { Router } from 'express';
import { requireAuth, requireRole, requirePermission } from '../../shared/middleware/auth.js';
import { ROLES, PERMISSION_KEYS } from '@ap/shared-constants';
import { DisputesController } from './disputes.controller.js';

export function createAdminDisputesRouter(): Router {
  const router = Router();

  router.use(requireAuth);
  router.use(requireRole(ROLES.SUPER_ADMIN, ROLES.MODERATOR));

  router.get('/', requirePermission(PERMISSION_KEYS.DISPUTE_VIEW), DisputesController.list);
  router.post('/claim-next', requirePermission(PERMISSION_KEYS.DISPUTE_RESOLVE), DisputesController.claimNext);
  router.post('/:id/claim', requirePermission(PERMISSION_KEYS.DISPUTE_RESOLVE), DisputesController.claim);
  router.post('/:id/release', requirePermission(PERMISSION_KEYS.DISPUTE_RESOLVE), DisputesController.release);
  router.get('/:id', requirePermission(PERMISSION_KEYS.DISPUTE_VIEW), DisputesController.getDetail);
  router.post('/:id/messages', requirePermission(PERMISSION_KEYS.DISPUTE_RESOLVE), DisputesController.addMessage);
  router.post('/:id/evidence', requirePermission(PERMISSION_KEYS.DISPUTE_RESOLVE), DisputesController.addEvidence);
  router.patch(
    '/:id/evidence/:evidenceId/visibility',
    requirePermission(PERMISSION_KEYS.DISPUTE_RESOLVE),
    DisputesController.setEvidenceVisibility,
  );
  router.post('/:id/request-info', requirePermission(PERMISSION_KEYS.DISPUTE_RESOLVE), DisputesController.requestInfo);
  router.post('/:id/decision/preview', requirePermission(PERMISSION_KEYS.DISPUTE_RESOLVE), DisputesController.decisionPreview);
  router.post('/:id/decision', requirePermission(PERMISSION_KEYS.DISPUTE_RESOLVE), DisputesController.executeDecision);

  // Super Admin only: accept reopen
  router.post(
    '/:id/accept-reopen',
    requireRole(ROLES.SUPER_ADMIN),
    DisputesController.acceptReopen,
  );

  return router;
}
