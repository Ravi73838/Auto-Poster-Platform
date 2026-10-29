import type { Request, Response } from 'express';
import { ERROR_CODES } from '@ap/shared-constants';
import type { ApiFailureResponse } from '@ap/shared-types';

export function notFoundHandler(req: Request, res: Response): void {
  const failure: ApiFailureResponse = {
    success: false,
    error: {
      code: ERROR_CODES.NOT_FOUND,
      message: `Cannot ${req.method} ${req.originalUrl}`,
    },
  };
  res.status(404).json(failure);
}
