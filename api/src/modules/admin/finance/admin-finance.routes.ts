import { Router } from 'express';
import { AdminFinanceController } from './admin-finance.controller.js';
import { requirePermission } from '../../../shared/middleware/auth.js';
import { requireStepUp } from '../../../shared/middleware/step-up.js';

export function createAdminFinanceRouter(): Router {
  const router = Router();

  router.get('/dashboard', requirePermission('payment.view', 'ledger.view'), AdminFinanceController.getDashboard);
  router.post('/pause', requirePermission('finance.settings'), requireStepUp(), AdminFinanceController.togglePause);

  // Payments
  router.get('/payments', requirePermission('payment.view'), AdminFinanceController.listPayments);

  // Refunds
  router.get('/refunds', requirePermission('payment.view'), AdminFinanceController.listRefunds);
  router.post('/refunds', requirePermission('payment.refund'), AdminFinanceController.requestRefund);
  router.post('/refunds/:id/review', requirePermission('payment.refund'), AdminFinanceController.reviewRefund);

  // Settlements
  router.get('/settlements', requirePermission('settlement.view'), AdminFinanceController.listSettlements);
  router.post('/settlements/:id/review', requirePermission('settlement.approve'), AdminFinanceController.reviewSettlement);
  router.post('/campaigns/:id/closeout', requirePermission('settlement.approve'), AdminFinanceController.closeoutCampaign);

  // Payouts
  router.get('/payouts', requirePermission('payout.view'), AdminFinanceController.listPayouts);
  router.post('/payouts/export-csv', requirePermission('payout.process'), AdminFinanceController.exportPayoutsCsv);
  router.post('/payouts/import-csv', requirePermission('payout.process'), AdminFinanceController.importPayoutsCsv);

  // Ledger Explorer & Trial Balance
  router.get('/ledger/accounts', requirePermission('ledger.view'), AdminFinanceController.listAccounts);
  router.get('/ledger/transactions', requirePermission('ledger.view'), AdminFinanceController.listTransactions);
  router.get('/ledger/trial-balance', requirePermission('ledger.view'), AdminFinanceController.getTrialBalance);

  // Adjustments
  router.get('/adjustments', requirePermission('ledger.view'), AdminFinanceController.listAdjustments);
  router.post('/adjustments', requirePermission('ledger.adjust'), AdminFinanceController.requestAdjustment);
  router.post('/adjustments/:id/review', requirePermission('ledger.adjust'), requireStepUp(), AdminFinanceController.reviewAdjustment);

  return router;
}

