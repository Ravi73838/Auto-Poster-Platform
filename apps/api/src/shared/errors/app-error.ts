import { ERROR_CODES, type ErrorCode } from '@ap/shared-constants';

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly httpStatus: number;
  readonly details?: unknown;

  constructor(
    code: ErrorCode = ERROR_CODES.INTERNAL_ERROR,
    message: string,
    httpStatus = 500,
    details?: unknown,
  ) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.httpStatus = httpStatus;
    this.details = details;
    Object.setPrototypeOf(this, AppError.prototype);
  }
}
