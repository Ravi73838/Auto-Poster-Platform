import { Router } from 'express';
import { CompanyCampaignsController } from './company-campaigns.controller.js';
import { CampaignPaymentController } from '../payments/campaign-payment.controller.js';
import { requireAuth, requireRole, requireApproved } from '../../shared/middleware/auth.js';
import { ROLES } from '@ap/shared-constants';

export function createCompanyCampaignsRouter(): Router {
  const router = Router();

  router.use(requireAuth());

  // Rules can be accessed by approved companies or admins
  router.get('/rules', CompanyCampaignsController.getRules);

  // All subsequent routes require COMPANY role and APPROVED account status
  router.use(requireRole(ROLES.COMPANY));
  router.use(requireApproved());

  router.get('/availability', CompanyCampaignsController.getAvailability);
  router.post('/price-preview', CompanyCampaignsController.pricePreview);

  router.post('/', CompanyCampaignsController.createDraft);
  router.get('/', CompanyCampaignsController.list);

  router.get('/:id', CompanyCampaignsController.getDetail);
  router.patch('/:id', CompanyCampaignsController.updateDraft);
  router.put('/:id', CompanyCampaignsController.updateDraft);
  router.delete('/:id', CompanyCampaignsController.deleteDraft);

  router.post('/:id/clone', CompanyCampaignsController.clone);
  router.post('/:id/submit', CompanyCampaignsController.submit);
  router.post('/:id/cancel', CompanyCampaignsController.cancel);
  router.post('/:id/reopen', CompanyCampaignsController.reopen);
  router.get('/:id/payment-summary', CompanyCampaignsController.getPaymentSummary);

  // Phase 8 Payments
  router.post('/:id/payment/order', CampaignPaymentController.createOrder);
  router.post('/:id/payment/verify', CampaignPaymentController.verify);
  router.get('/:id/payments', CampaignPaymentController.listPayments);
  router.get('/:id/invoices', CampaignPaymentController.listInvoices);

  return router;
}
