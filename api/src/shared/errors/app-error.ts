import { ERROR_CODES, type ErrorCode } from '@ap/shared-constants';

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly httpStatus: number;
  readonly details?: unknown;

  constructor(code: ErrorCode, message: string, httpStatus?: number, details?: unknown);
  constructor(code: ErrorCode, httpStatus: number, message: string, details?: unknown);
  constructor(
    code: ErrorCode = ERROR_CODES.INTERNAL_ERROR,
    arg2: string | number = 'An unexpected error occurred',
    arg3?: number | string,
    arg4?: unknown,
  ) {
    let message: string;
    let httpStatus: number;
    let details: unknown;

    if (typeof arg2 === 'number') {
      httpStatus = arg2;
      message = typeof arg3 === 'string' ? arg3 : '';
      details = arg4;
    } else {
      message = arg2;
      httpStatus = typeof arg3 === 'number' ? arg3 : 500;
      details = typeof arg3 === 'number' ? arg4 : undefined;
    }

    super(message);
    this.name = 'AppError';
    this.code = code;
    this.httpStatus = httpStatus;
    this.details = details;
    Object.setPrototypeOf(this, AppError.prototype);
  }
}
