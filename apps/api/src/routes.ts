import { Router } from 'express';
import { ROLES } from '@ap/shared-constants';
import { requireRole } from './shared/middleware/auth.js';
import { adminIpAllowlist } from './shared/middleware/admin-ip-allowlist.js';
import { createHealthRouter } from './modules/health/routes.js';
import { createAuthRouter } from './modules/auth/routes.js';
import { createCompanyRouter } from './modules/company/routes.js';
import { createAdminRouter } from './modules/admin/routes.js';
import { createDriverRouter } from './modules/driver/routes.js';
import { createExampleRouter } from './modules/_template/routes.js';
import { uploadsRouter } from './modules/uploads/uploads.routes.js';
import { locationsRouter, legalRouter } from './modules/locations/locations.routes.js';
import { createNotificationsRouter } from './modules/notifications/notifications.routes.js';
import { createMeNotificationsRouter } from './modules/notifications/me-notifications.routes.js';
import { createDevicesRouter } from './modules/notifications/devices.routes.js';
import { createDevCampaignRouter } from './modules/campaigns/dev.routes.js';
import { CampaignPaymentController } from './modules/payments/campaign-payment.controller.js';
import { ContentController } from './modules/admin/content/content.controller.js';

export function createApiRouter(): Router {
  const router = Router();

  router.use('/health', createHealthRouter());
  router.use('/auth', createAuthRouter());
  router.use('/webhooks/razorpay', CampaignPaymentController.handleWebhook);
  router.use('/uploads', uploadsRouter);
  router.use('/locations', locationsRouter);
  router.use('/legal', legalRouter);
  router.get('/legal/:type', ContentController.getActiveLegalDocument);
  router.get('/help', ContentController.listHelpArticles);
  router.get('/help/:id', ContentController.getHelpArticle);
  router.use('/notifications', createNotificationsRouter());
  router.use('/me', createMeNotificationsRouter());
  router.use('/devices', createDevicesRouter());
  router.use('/company', requireRole(ROLES.COMPANY), createCompanyRouter());
  router.use(
    '/admin',
    adminIpAllowlist(),
    requireRole(ROLES.SUPER_ADMIN, ROLES.MODERATOR, ROLES.FINANCE),
    createAdminRouter(),
  );
  router.use('/driver', requireRole(ROLES.DRIVER), createDriverRouter());
  router.use('/dev', createDevCampaignRouter());
  router.use('/template', createExampleRouter());

  return router;
}


