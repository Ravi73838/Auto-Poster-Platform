import { Router } from 'express';
import { requireAuth, requireRole, requirePermission } from '../../shared/middleware/auth.js';
import { requireStepUp } from '../../shared/middleware/step-up.js';
import { ROLES, PERMISSION_KEYS } from '@ap/shared-constants';
import { DisciplineController } from './discipline.controller.js';

export function createAdminDisciplineRouter(): Router {
  const router = Router();

  const guard = [requireAuth, requireRole(ROLES.SUPER_ADMIN, ROLES.MODERATOR)];

  // Strikes
  router.post('/strikes', ...guard, requirePermission(PERMISSION_KEYS.STRIKE_MANAGE), DisciplineController.issueStrike);
  router.get('/strikes', ...guard, requirePermission(PERMISSION_KEYS.STRIKE_VIEW), DisciplineController.listStrikes);
  router.post('/strikes/:id/revoke', ...guard, requirePermission(PERMISSION_KEYS.STRIKE_MANAGE), DisciplineController.revokeStrike);

  // Bans
  router.get('/bans', ...guard, requirePermission(PERMISSION_KEYS.STRIKE_VIEW), DisciplineController.listBans);
  router.post('/bans/:id/lift', ...guard, requirePermission(PERMISSION_KEYS.STRIKE_MANAGE), requireStepUp(), DisciplineController.liftBan);

  // Driver discipline details
  router.get('/drivers/:driverId/discipline', ...guard, requirePermission(PERMISSION_KEYS.STRIKE_VIEW), DisciplineController.getDriverDisciplineAdmin);

  // Assignment termination & reinstatement
  router.post('/assignments/:id/terminate', ...guard, requirePermission(PERMISSION_KEYS.STRIKE_MANAGE), DisciplineController.terminateAssignment);
  router.post('/assignments/:id/reinstate', ...guard, requirePermission(PERMISSION_KEYS.STRIKE_MANAGE), requireStepUp(), DisciplineController.reinstateAssignment);

  return router;
}
