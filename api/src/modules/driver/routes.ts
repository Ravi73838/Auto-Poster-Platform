import { Router } from 'express';
import { ROLES } from '@ap/shared-constants';
import { DriverController } from './driver.controller.js';
import { authenticate, requireAuth, requireRole } from '../../shared/middleware/auth.js';
import { createDriverCampaignsRouter } from '../campaigns/driver-campaigns.routes.js';
import { createDriverAssignmentsRouter } from '../assignments/driver-assignments.routes.js';
import { createDriverDailyPhotosRouter } from '../daily-photos/driver-daily-photos.routes.js';
import { DriverWalletController } from '../wallet/driver-wallet.controller.js';
import { createDriverDisciplineRouter } from '../discipline/driver-discipline.routes.js';
import { createDriverDisputesRouter } from '../disputes/driver-disputes.routes.js';

export const driverRouter = Router();

// Driver authentication guard (allowed across onboarding statuses: PENDING, NEED_MORE_INFO, REJECTED, APPROVED)
driverRouter.use(authenticate, requireAuth, requireRole(ROLES.DRIVER));

// Test ping endpoint to verify role guard
driverRouter.get('/ping', (req, res) => {
  res.json({
    success: true,
    data: {
      message: 'pong',
      role: req.auth?.role,
    },
  });
});

driverRouter.get('/onboarding', DriverController.getOnboarding);
driverRouter.put('/profile', DriverController.updateProfile);
driverRouter.put('/vehicle', DriverController.updateVehicle);
driverRouter.post('/documents', DriverController.addDocument);
driverRouter.delete('/documents/:id', DriverController.deleteDocument);
driverRouter.put('/payout-details', DriverController.updatePayoutDetails);
driverRouter.post('/consents', DriverController.submitConsents);
driverRouter.post('/kyc/submit', DriverController.submitKyc);
driverRouter.get('/kyc', DriverController.getKyc);

// Phase 5 Campaign Discovery
driverRouter.use('/campaigns', createDriverCampaignsRouter());

// Phase 6 Assignments & Installation
driverRouter.use('/', createDriverAssignmentsRouter());

// Phase 7 Daily Proof & Days
driverRouter.use('/', createDriverDailyPhotosRouter());

// Phase 8 Wallet, Withdrawals & Settlements
driverRouter.get('/wallet', DriverWalletController.getWallet);
driverRouter.get('/wallet/statement', DriverWalletController.getStatement);
driverRouter.post('/withdrawals', DriverWalletController.requestWithdrawal);
driverRouter.get('/payouts', DriverWalletController.listPayouts);
driverRouter.get('/assignments/:id/settlement', DriverWalletController.getAssignmentSettlement);

// Phase 9 Discipline & Disputes
driverRouter.use('/discipline', createDriverDisciplineRouter());
driverRouter.use('/disputes', createDriverDisputesRouter());

export function createDriverRouter(): Router {
  return driverRouter;
}

