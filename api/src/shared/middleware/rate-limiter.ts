import rateLimit from 'express-rate-limit';
import { ERROR_CODES } from '@ap/shared-constants';
import type { ApiFailureResponse } from '@ap/shared-types';

export function createRateLimiter(options?: {
  windowMs?: number;
  max?: number;
  keyPrefix?: string;
}) {
  return rateLimit({
    windowMs: options?.windowMs ?? 15 * 60 * 1000,
    max: options?.max ?? 300,
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
}

export const rateLimiter = createRateLimiter();
export const stepUpRateLimiter = createRateLimiter({ windowMs: 15 * 60 * 1000, max: 10 });
export const revealRateLimiter = createRateLimiter({ windowMs: 15 * 60 * 1000, max: 30 });
