import { Router } from 'express';
import { AdminDailyPhotosController } from './admin-daily-photos.controller.js';
import { requireAuth, requireRole } from '../../shared/middleware/auth.js';
import { ROLES } from '@ap/shared-constants';

export function createAdminDailyPhotosRouter(): Router {
  const router = Router();

  const guard = [requireAuth(), requireRole(ROLES.SUPER_ADMIN, ROLES.MODERATOR)];

  // Daily photos queue & claim
  router.get('/daily-photos/queue', ...guard, AdminDailyPhotosController.getQueue);
  router.post('/daily-photos/claim-next', ...guard, AdminDailyPhotosController.claimNext);
  router.post('/daily-photos/:id/claim', ...guard, AdminDailyPhotosController.claim);
  router.post('/daily-photos/:id/release', ...guard, AdminDailyPhotosController.release);
  router.get('/daily-photos/:id', ...guard, AdminDailyPhotosController.getDetail);
  router.post('/daily-photos/:id/review', ...guard, AdminDailyPhotosController.decide);

  // Excuse day override
  router.post('/assignments/:id/days/:date/excuse', ...guard, AdminDailyPhotosController.excuseDay);

  // Fraud overview & trust tier
  router.get('/fraud/overview', ...guard, AdminDailyPhotosController.getFraudOverview);
  router.get('/drivers/:id/trust', ...guard, AdminDailyPhotosController.getDriverTrust);

  return router;
}

