import { Router, type Request, type Response, type NextFunction } from 'express';
import { env } from '../../config/env.js';
import { CampaignPaymentBridge } from './payment-bridge.js';
import { AppError } from '../../shared/errors/index.js';
import { ERROR_CODES } from '@ap/shared-constants';

export function createDevCampaignRouter(): Router {
  const router = Router();

  router.post('/campaigns/:id/simulate-payment', async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!env.ENABLE_DEV_PAYMENT_SIMULATION) {
        throw new AppError(ERROR_CODES.FORBIDDEN, 403, 'Dev payment simulation is disabled');
      }

      const paymentRef = `DEV_SIM_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const campaign = await CampaignPaymentBridge.markPaid(req.params.id!, paymentRef);

      res.status(200).json({
        success: true,
        data: {
          campaignId: campaign.id,
          status: campaign.status,
          liveAt: campaign.liveAt,
          paymentRef,
        },
      });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
