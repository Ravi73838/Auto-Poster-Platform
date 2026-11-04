import { Router } from 'express';
import { AdminDailyPhotosController } from './admin-daily-photos.controller.js';
import { requireAuth, requireRole } from '../../shared/middleware/auth.js';
import { ROLES } from '@ap/shared-constants';

export function createAdminDailyPhotosRouter(): Router {
  const router = Router();

  router.use(requireAuth());
  router.use(requireRole(ROLES.SUPER_ADMIN, ROLES.MODERATOR));

  // Daily photos queue & claim
  router.get('/daily-photos/queue', AdminDailyPhotosController.getQueue);
  router.post('/daily-photos/claim-next', AdminDailyPhotosController.claimNext);
  router.post('/daily-photos/:id/claim', AdminDailyPhotosController.claim);
  router.post('/daily-photos/:id/release', AdminDailyPhotosController.release);
  router.get('/daily-photos/:id', AdminDailyPhotosController.getDetail);
  router.post('/daily-photos/:id/review', AdminDailyPhotosController.decide);

  // Excuse day override
  router.post('/assignments/:id/days/:date/excuse', AdminDailyPhotosController.excuseDay);

  // Fraud overview & trust tier
  router.get('/fraud/overview', AdminDailyPhotosController.getFraudOverview);
  router.get('/drivers/:id/trust', AdminDailyPhotosController.getDriverTrust);

  return router;
}

