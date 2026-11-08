import { Router } from 'express';
import { ROLES } from '@ap/shared-constants';
import { requireRole, requirePermission } from '../../shared/middleware/auth.js';
import { requireStepUp } from '../../shared/middleware/step-up.js';
import { AdminTeamController } from './team.controller.js';
import { createAdminCampaignsRouter } from '../campaigns/admin-campaigns.routes.js';
import { adminLocationsRouter } from '../locations/admin-locations.routes.js';
import { createAdminInstallationsRouter } from '../assignments/admin-installations.routes.js';
import { createAdminDailyPhotosRouter } from '../daily-photos/admin-daily-photos.routes.js';
import { createAdminFinanceRouter } from './finance/admin-finance.routes.js';
import { createAdminDisciplineRouter } from '../discipline/admin-discipline.routes.js';
import { createAdminDisputesRouter } from '../disputes/admin-disputes.routes.js';
import { createAnnouncementsRouter } from '../announcements/announcements.routes.js';
import { createAdminStepUpRouter } from './step-up/step-up.routes.js';
import { WorkQueuesController } from './work-queues/work-queues.controller.js';
import { AdminSearchController } from './search/admin-search.controller.js';
import { AnalyticsController } from './analytics/analytics.controller.js';
import { ReportsController } from './reports/reports.controller.js';
import { Entity360Controller } from './entity-360/entity-360.controller.js';
import { SavedViewsController } from './saved-views/saved-views.controller.js';
import { AdminSettingsController } from './settings/admin-settings.controller.js';
import { RolesController } from './roles/roles.controller.js';
import { ContentController } from './content/content.controller.js';
import { SystemController } from './system/system.controller.js';
import { LaunchController } from './launch/launch.controller.js';
import { PilotAdminController } from './pilot/pilot-admin.controller.js';

export function createAdminRouter(): Router {
  const router = Router();

  // Test ping endpoint to verify role guard
  router.get('/ping', requireRole(ROLES.SUPER_ADMIN, ROLES.MODERATOR, ROLES.FINANCE), (req, res) => {
    res.json({
      success: true,
      data: {
        message: 'pong',
        role: req.auth?.role,
      },
    });
  });

  // Admin Team Management
  router.post('/team', requirePermission('team.manage'), AdminTeamController.createAdmin);
  router.get('/team', requirePermission('team.manage'), AdminTeamController.listAdmins);
  router.patch('/team/:id/status', requirePermission('team.manage'), AdminTeamController.updateAdminStatus);
  router.patch('/team/:id', requirePermission('team.manage'), requireStepUp(), AdminTeamController.updateAdminRole);

  // Campaigns & Locations
  router.use('/campaigns', createAdminCampaignsRouter());
  router.use('/locations', adminLocationsRouter);

  // Phase 6 Installation Reviews
  router.use('/installations', createAdminInstallationsRouter());

  // Phase 7 Daily Photo Reviews & Fraud
  router.use('/', createAdminDailyPhotosRouter());

  // Phase 8 Finance Management Portal
  router.use('/finance', createAdminFinanceRouter());

  // Phase 9 Discipline, Disputes, Announcements
  router.use('/', createAdminDisciplineRouter());
  router.use('/disputes', createAdminDisputesRouter());
  router.use('/announcements', createAnnouncementsRouter());

  // Phase 10 Step-Up & PII Reveal
  router.use('/', createAdminStepUpRouter());

  // Phase 10 Work Queues & My Work
  router.get('/work-queues/summary', WorkQueuesController.getSummary);
  router.get('/my-work', WorkQueuesController.getMyWork);
  router.post('/queues/assign', requirePermission('queue.assign'), WorkQueuesController.assignQueueItem);
  router.get('/team/workload', requirePermission('team.manage'), WorkQueuesController.getTeamWorkload);

  // Phase 10 Omnisearch
  router.get('/search', AdminSearchController.search);

  // Phase 10 Analytics & Rollups
  router.get('/analytics/overview', requirePermission('report.view'), AnalyticsController.getOverview);
  router.post('/analytics/rollup', requirePermission('system.manage'), AnalyticsController.triggerRollup);

  // Phase 10 Reports Registry
  router.post('/reports/export', requirePermission('report.export'), ReportsController.requestExport);
  router.get('/reports/exports', requirePermission('report.view'), ReportsController.listExports);
  router.get('/reports/exports/:id/download', requirePermission('report.view'), ReportsController.downloadExport);

  // Phase 10 360-Degree Overviews & Entity History
  router.get('/drivers', requirePermission('kyc.view', 'driver.view'), Entity360Controller.listDrivers);
  router.get('/companies', requirePermission('kyc.view', 'company.view'), Entity360Controller.listCompanies);
  router.get('/drivers/:id/overview', requirePermission('kyc.view', 'driver.view'), Entity360Controller.getDriverOverview);
  router.get('/companies/:id/overview', requirePermission('kyc.view', 'company.view'), Entity360Controller.getCompanyOverview);
  router.patch('/companies/:id/status', requirePermission('kyc.review', 'user.manage'), Entity360Controller.updateCompanyStatus);
  router.patch('/companies/:id/verify', requirePermission('kyc.review', 'user.manage'), Entity360Controller.verifyCompany);
  router.patch('/drivers/:id/status', requirePermission('kyc.review', 'user.manage'), Entity360Controller.updateDriverStatus);
  router.patch('/drivers/:id/verify', requirePermission('kyc.review', 'user.manage'), Entity360Controller.verifyDriver);
  router.get('/audit-logs', requirePermission('audit.view'), Entity360Controller.listAuditLogs);

  // Phase 10 Saved Views
  router.get('/saved-views', SavedViewsController.listSavedViews);
  router.post('/saved-views', SavedViewsController.createSavedView);
  router.put('/saved-views/:id', SavedViewsController.updateSavedView);
  router.delete('/saved-views/:id', SavedViewsController.deleteSavedView);

  // Phase 10 Settings & Maker-Checker
  router.get('/settings', requirePermission('settings.view'), AdminSettingsController.listGroupedSettings);
  router.post('/settings/request-change', requirePermission('settings.update'), AdminSettingsController.updateOrRequestSetting);
  router.get('/settings/change-requests', requirePermission('settings.view'), AdminSettingsController.listChangeRequests);
  router.post(
    '/settings/change-requests/:id/review',
    requirePermission('settings.approve'),
    requireStepUp(),
    AdminSettingsController.reviewChangeRequest,
  );

  // Phase 10 Roles & Permissions Matrix
  router.get('/roles/matrix', requirePermission('role.manage'), RolesController.getRolesMatrix);
  router.put('/roles/matrix', requirePermission('role.manage'), requireStepUp(), RolesController.updateRolePermissions);

  // Phase 10 Content Management (Legal & Help)
  router.get('/legal', requirePermission('legal.manage'), ContentController.listLegalDocuments);
  router.post('/legal', requirePermission('legal.manage'), ContentController.createLegalDocument);
  router.post(
    '/legal/:id/publish',
    requirePermission('legal.manage'),
    requireStepUp(),
    ContentController.publishLegalDocument,
  );
  router.get('/help', requirePermission('help.manage'), ContentController.listHelpArticles);
  router.get('/help/:id', requirePermission('help.manage'), ContentController.getHelpArticle);
  router.post('/help', requirePermission('help.manage'), ContentController.createHelpArticle);
  router.put('/help/:id', requirePermission('help.manage'), ContentController.updateHelpArticle);
  router.delete('/help/:id', requirePermission('help.manage'), ContentController.deleteHelpArticle);

  // Phase 10 System Health & Jobs Monitoring
  router.get('/system/health', requirePermission('system.view'), SystemController.getHealth);
  router.get('/system/jobs', requirePermission('system.view'), SystemController.listJobRuns);
  router.post(
    '/system/jobs/:id/retry',
    requirePermission('system.manage'),
    requireStepUp(),
    SystemController.retryJob,
  );

  // Phase 15 Launch Readiness & Sign-offs Gate
  router.get('/launch/readiness', requirePermission('system.view', 'audit.view'), LaunchController.getReadiness);
  router.get('/launch/sign-offs', requirePermission('system.view', 'audit.view'), LaunchController.getSignOffs);
  router.post(
    '/launch/sign-offs',
    requireRole(ROLES.SUPER_ADMIN),
    requireStepUp(),
    LaunchController.attestSignOff,
  );
  router.delete(
    '/launch/sign-offs/:key',
    requireRole(ROLES.SUPER_ADMIN),
    requireStepUp(),
    LaunchController.revokeSignOff,
  );

  // Phase 15 Pilot Operations, Command Center, Quality Review & Print Shops
  router.get('/pilot/command-center', requirePermission('system.view', 'audit.view'), PilotAdminController.getCommandCenter);
  router.get('/pilot/anomalies', requirePermission('system.view', 'audit.view'), PilotAdminController.listAnomalies);
  router.patch('/pilot/anomalies/:id', requirePermission('system.manage'), PilotAdminController.resolveAnomaly);
  router.get('/pilot/quality-review', requirePermission('photo.approve', 'kyc.approve'), PilotAdminController.listSecondLooks);
  router.post('/pilot/quality-review/:id/decide', requirePermission('photo.approve'), PilotAdminController.decideSecondLook);
  router.get('/pilot/invite-codes', requirePermission('kyc.view', 'settings.view'), PilotAdminController.listInviteCodes);
  router.post('/pilot/invite-codes', requirePermission('team.manage', 'settings.manage'), PilotAdminController.createInviteCode);
  router.post('/pilot/invite-codes/batch', requirePermission('team.manage', 'settings.manage'), PilotAdminController.createInviteBatch);
  router.delete('/pilot/invite-codes/:id', requirePermission('team.manage', 'settings.manage'), PilotAdminController.revokeInviteCode);
  router.get('/pilot/waitlist', requirePermission('kyc.view'), PilotAdminController.listWaitlist);
  router.post('/pilot/waitlist/:id/invite', requirePermission('kyc.review'), PilotAdminController.inviteWaitlist);
  router.get('/pilot/print-shops', requirePermission('location.manage', 'kyc.view'), PilotAdminController.listPrintShops);
  router.post('/pilot/print-shops', requirePermission('location.manage'), PilotAdminController.createPrintShop);
  router.patch('/pilot/print-shops/:id', requirePermission('location.manage'), PilotAdminController.updatePrintShop);
  router.delete('/pilot/print-shops/:id', requirePermission('location.manage'), PilotAdminController.deletePrintShop);

  return router;
}

