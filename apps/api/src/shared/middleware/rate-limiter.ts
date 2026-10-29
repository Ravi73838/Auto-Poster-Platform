import rateLimit from 'express-rate-limit';
import { ERROR_CODES } from '@ap/shared-constants';
import type { ApiFailureResponse } from '@ap/shared-types';

export const rateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => {
    const response: ApiFailureResponse = {
      success: false,
      error: {
        code: ERROR_CODES.RATE_LIMITED,
        message: 'Too many requests. Please try again later.',
      },
    };
    res.status(429).json(response);
  },
});
