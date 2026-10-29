import type { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { ERROR_CODES } from '@ap/shared-constants';
import type { ApiFailureResponse } from '@ap/shared-types';
import { AppError } from '../errors/app-error.js';
import { logger } from '../logger/index.js';
import { env } from '../../config/env.js';

export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (err instanceof AppError) {
    logger.warn(
      {
        requestId: req.id,
        code: err.code,
        status: err.httpStatus,
        message: err.message,
      },
      'Application handled error',
    );

    const failure: ApiFailureResponse = {
      success: false,
      error: {
        code: err.code,
        message: err.message,
        details: err.details,
      },
    };
    res.status(err.httpStatus).json(failure);
    return;
  }

  if (err instanceof ZodError) {
    logger.warn({ requestId: req.id, issues: err.issues }, 'Validation error');
    const failure: ApiFailureResponse = {
      success: false,
      error: {
        code: ERROR_CODES.VALIDATION_ERROR,
        message: 'Validation failed',
        details: err.flatten(),
      },
    };
    res.status(400).json(failure);
    return;
  }

  logger.error({ requestId: req.id, err }, 'Unhandled server exception');

  const failure: ApiFailureResponse = {
    success: false,
    error: {
      code: ERROR_CODES.INTERNAL_ERROR,
      message: 'Internal server error',
      details: env.NODE_ENV === 'development' && err instanceof Error ? err.stack : undefined,
    },
  };
  res.status(500).json(failure);
}
