import { Router } from 'express';
import { createHealthRouter } from './modules/health/routes.js';
import { createAuthRouter } from './modules/auth/routes.js';
import { createCompanyRouter } from './modules/company/routes.js';
import { createAdminRouter } from './modules/admin/routes.js';
import { createDriverRouter } from './modules/driver/routes.js';
import { createExampleRouter } from './modules/_template/routes.js';

export function createApiRouter(): Router {
  const router = Router();

  router.use('/health', createHealthRouter());
  router.use('/auth', createAuthRouter());
  router.use('/company', createCompanyRouter());
  router.use('/admin', createAdminRouter());
  router.use('/driver', createDriverRouter());
  router.use('/template', createExampleRouter());

  return router;
}
