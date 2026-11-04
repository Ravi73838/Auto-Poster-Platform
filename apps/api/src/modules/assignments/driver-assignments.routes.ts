import { Router } from 'express';
import { DriverAssignmentsController } from './driver-assignments.controller.js';
import { requireAuth, requireRole, requireApproved } from '../../shared/middleware/auth.js';
import { ROLES } from '@ap/shared-constants';

export function createDriverAssignmentsRouter(): Router {
  const router = Router();

  router.use(requireAuth());
  router.use(requireRole(ROLES.DRIVER));
  router.use(requireApproved());

  // Campaign selection
  router.post('/campaigns/:id/select', DriverAssignmentsController.selectCampaign);

  // Assignments lifecycle
  router.get('/assignments', DriverAssignmentsController.list);
  router.get('/assignments/:id', DriverAssignmentsController.getDetail);
  router.post('/assignments/:id/start-installing', DriverAssignmentsController.startInstalling);
  router.post('/assignments/:id/withdraw', DriverAssignmentsController.withdraw);
  router.get('/assignments/:id/poster-download', DriverAssignmentsController.getPosterDownload);
  router.get('/assignments/:id/print-guide', DriverAssignmentsController.getPrintGuide);
  router.post('/assignments/:id/installation', DriverAssignmentsController.submitInstallation);

  return router;
}

