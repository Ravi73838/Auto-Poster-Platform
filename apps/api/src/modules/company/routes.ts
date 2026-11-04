import { Router } from 'express';
import { ROLES } from '@ap/shared-constants';
import { CompanyController } from './company.controller.js';
import { authenticate, requireAuth, requireRole } from '../../shared/middleware/auth.js';
import { createCompanyCampaignsRouter } from '../campaigns/company-campaigns.routes.js';
import { createCompanyInstallationsRouter } from '../assignments/company-installations.routes.js';
import { createCompanyDailyPhotosRouter } from '../daily-photos/company-daily-photos.routes.js';
import { CampaignPaymentController } from '../payments/campaign-payment.controller.js';
import { createCompanyDisputesRouter } from '../disputes/company-disputes.routes.js';

export const companyRouter = Router();

companyRouter.use(authenticate, requireAuth(), requireRole(ROLES.COMPANY));

// Test ping endpoint to verify role guard
companyRouter.get('/ping', (req, res) => {
  res.json({
    success: true,
    data: {
      message: 'pong',
      role: req.auth?.role,
    },
  });
});

companyRouter.get('/onboarding', CompanyController.getOnboarding);
companyRouter.put('/profile', CompanyController.updateProfile);
companyRouter.post('/documents', CompanyController.addDocument);
companyRouter.delete('/documents/:id', CompanyController.deleteDocument);
companyRouter.post('/consents', CompanyController.submitConsents);
companyRouter.post('/kyc/submit', CompanyController.submitKyc);
companyRouter.get('/kyc', CompanyController.getKyc);

// Phase 5 Campaigns
companyRouter.use('/campaigns', createCompanyCampaignsRouter());

// Phase 6 Installations
companyRouter.use('/', createCompanyInstallationsRouter());

// Phase 7 Daily Proof & Progress
companyRouter.use('/', createCompanyDailyPhotosRouter());

// Phase 8 Payments & Tax Documents
companyRouter.get('/payments', CampaignPaymentController.listAllCompanyPayments);
companyRouter.get('/tax-documents/:id/pdf', CampaignPaymentController.downloadPdf);

// Phase 9 Disputes
companyRouter.use('/disputes', createCompanyDisputesRouter());

export function createCompanyRouter(): Router {
  return companyRouter;
}

