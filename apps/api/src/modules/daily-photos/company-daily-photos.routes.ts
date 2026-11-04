import { Router } from 'express';
import { CompanyDailyPhotosController } from './company-daily-photos.controller.js';
import { requireAuth, requireRole, requireApproved } from '../../shared/middleware/auth.js';
import { ROLES } from '@ap/shared-constants';

export function createCompanyDailyPhotosRouter(): Router {
  const router = Router();

  router.use(requireAuth());
  router.use(requireRole(ROLES.COMPANY));
  router.use(requireApproved());

  router.get('/campaigns/:id/progress', CompanyDailyPhotosController.getProgress);
  router.get('/campaigns/:id/photos', CompanyDailyPhotosController.listPhotos);
  router.get('/campaigns/:id/map', CompanyDailyPhotosController.getMapPoints);
  router.post('/campaigns/:id/photos/:photoId/flag', CompanyDailyPhotosController.flagPhoto);
  router.get('/campaigns/:id/report.csv', CompanyDailyPhotosController.getCsvReport);

  return router;
}

