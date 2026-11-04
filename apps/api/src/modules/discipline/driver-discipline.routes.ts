import { Router } from 'express';
import { requireAuth, requireRole } from '../../shared/middleware/auth.js';
import { ROLES } from '@ap/shared-constants';
import { DisciplineController } from './discipline.controller.js';

export function createDriverDisciplineRouter(): Router {
  const router = Router();

  router.use(requireAuth);
  router.use(requireRole(ROLES.DRIVER));

  router.get('/', DisciplineController.getDriverDisciplineMe);
  router.get('/rules', DisciplineController.getDriverDisciplineRules);

  return router;
}

