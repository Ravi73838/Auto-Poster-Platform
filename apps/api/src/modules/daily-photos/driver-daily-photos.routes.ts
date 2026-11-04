import { Router } from 'express';
import { DriverDailyPhotosController } from './driver-daily-photos.controller.js';
import { requireAuth, requireRole, requireApproved } from '../../shared/middleware/auth.js';
import { ROLES } from '@ap/shared-constants';

export function createDriverDailyPhotosRouter(): Router {
  const router = Router();

  router.use(requireAuth());
  router.use(requireRole(ROLES.DRIVER));
  router.use(requireApproved());

  router.post('/assignments/:id/daily-photos', DriverDailyPhotosController.submitDailyPhoto);
  router.get('/assignments/:id/today', DriverDailyPhotosController.getTodayStatus);
  router.get('/assignments/:id/days', DriverDailyPhotosController.getDays);
  router.get('/assignments/:id/daily-photos', DriverDailyPhotosController.listPhotos);

  return router;
}

