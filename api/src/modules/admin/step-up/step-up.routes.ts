import { Router } from 'express';
import { requirePermission } from '../../../shared/middleware/auth.js';
import { requireStepUp } from '../../../shared/middleware/step-up.js';
import { stepUpRateLimiter, revealRateLimiter } from '../../../shared/middleware/rate-limiter.js';
import { StepUpController } from './step-up.controller.js';

export function createAdminStepUpRouter(): Router {
  const router = Router();

  router.post('/step-up/request', stepUpRateLimiter, StepUpController.requestChallenge);
  router.post('/step-up/verify', stepUpRateLimiter, StepUpController.verifyChallenge);
  router.get('/step-up/status', StepUpController.getStatus);

  router.post(
    '/reveal',
    revealRateLimiter,
    requirePermission('pii.reveal'),
    requireStepUp(),
    StepUpController.revealPii,
  );

  return router;
}
