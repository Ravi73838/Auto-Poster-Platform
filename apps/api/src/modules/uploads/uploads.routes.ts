import { Router } from 'express';
import { UploadsController } from './uploads.controller.js';
import { authenticate, requireAuth } from '../../shared/middleware/auth.js';
import { createRateLimiter } from '../../shared/middleware/rate-limiter.js';

export const uploadsRouter = Router();

// Rate limit upload requests: 60 requests per 15 minutes
const uploadLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 60,
  keyPrefix: 'ratelimit:uploads:',
});

uploadsRouter.use(authenticate, requireAuth, uploadLimiter);

uploadsRouter.post('/presign', UploadsController.presign);
uploadsRouter.post('/confirm', UploadsController.confirm);
uploadsRouter.get('/:fileId/url', UploadsController.getUrl);


