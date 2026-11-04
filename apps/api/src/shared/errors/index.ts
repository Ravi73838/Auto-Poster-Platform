import { ERROR_CODES } from '@ap/shared-constants';
import { AppError } from './app-error.js';

export { AppError } from './app-error.js';

export class NotFoundError extends AppError {
  constructor(message = 'Resource not found', details?: unknown) {
    super(ERROR_CODES.NOT_FOUND, message, 404, details);
    this.name = 'NotFoundError';
    Object.setPrototypeOf(this, NotFoundError.prototype);
  }
}

export class ConflictError extends AppError {
  constructor(message = 'Resource conflict', details?: unknown) {
    super(ERROR_CODES.CONFLICT, message, 409, details);
    this.name = 'ConflictError';
    Object.setPrototypeOf(this, ConflictError.prototype);
  }
}

export class ValidationError extends AppError {
  constructor(message = 'Validation failed', details?: unknown) {
    super(ERROR_CODES.VALIDATION_ERROR, message, 422, details);
    this.name = 'ValidationError';
    Object.setPrototypeOf(this, ValidationError.prototype);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized', details?: unknown) {
    super(ERROR_CODES.UNAUTHORIZED, message, 401, details);
    this.name = 'UnauthorizedError';
    Object.setPrototypeOf(this, UnauthorizedError.prototype);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Forbidden', details?: unknown) {
    super(ERROR_CODES.FORBIDDEN, message, 403, details);
    this.name = 'ForbiddenError';
    Object.setPrototypeOf(this, ForbiddenError.prototype);
  }
}

export class InvalidStateTransitionError extends AppError {
  constructor(message = 'Invalid state transition', details?: unknown) {
    super(ERROR_CODES.INVALID_STATE_TRANSITION, message, 400, details);
    this.name = 'InvalidStateTransitionError';
    Object.setPrototypeOf(this, InvalidStateTransitionError.prototype);
  }
}

export class InsufficientFundsError extends AppError {
  constructor(message = 'Insufficient funds', details?: unknown) {
    super(ERROR_CODES.INSUFFICIENT_FUNDS, message, 400, details);
    this.name = 'InsufficientFundsError';
    Object.setPrototypeOf(this, InsufficientFundsError.prototype);
  }
}

export class LedgerUnbalancedError extends AppError {
  constructor(message = 'Ledger transaction is unbalanced', details?: unknown) {
    super(ERROR_CODES.LEDGER_UNBALANCED, message, 400, details);
    this.name = 'LedgerUnbalancedError';
    Object.setPrototypeOf(this, LedgerUnbalancedError.prototype);
  }
}

export class SettingNotFoundError extends AppError {
  constructor(message = 'Setting not found', details?: unknown) {
    super(ERROR_CODES.SETTING_NOT_FOUND, message, 404, details);
    this.name = 'SettingNotFoundError';
    Object.setPrototypeOf(this, SettingNotFoundError.prototype);
  }
}

export class InvalidCredentialsError extends AppError {
  constructor(message = 'Invalid email or password', details?: unknown) {
    super(ERROR_CODES.INVALID_CREDENTIALS, message, 401, details);
    this.name = 'InvalidCredentialsError';
    Object.setPrototypeOf(this, InvalidCredentialsError.prototype);
  }
}

export class OtpInvalidError extends AppError {
  constructor(message = 'Invalid verification code', details?: unknown) {
    super(ERROR_CODES.OTP_INVALID, message, 400, details);
    this.name = 'OtpInvalidError';
    Object.setPrototypeOf(this, OtpInvalidError.prototype);
  }
}

export class OtpExpiredError extends AppError {
  constructor(message = 'Verification code has expired', details?: unknown) {
    super(ERROR_CODES.OTP_EXPIRED, message, 400, details);
    this.name = 'OtpExpiredError';
    Object.setPrototypeOf(this, OtpExpiredError.prototype);
  }
}

export class OtpTooManyAttemptsError extends AppError {
  constructor(message = 'Too many incorrect verification attempts', details?: unknown) {
    super(ERROR_CODES.OTP_TOO_MANY_ATTEMPTS, message, 429, details);
    this.name = 'OtpTooManyAttemptsError';
    Object.setPrototypeOf(this, OtpTooManyAttemptsError.prototype);
  }
}

export class OtpRateLimitedError extends AppError {
  constructor(message = 'Too many verification requests. Please wait.', details?: unknown) {
    super(ERROR_CODES.OTP_RATE_LIMITED, message, 429, details);
    this.name = 'OtpRateLimitedError';
    Object.setPrototypeOf(this, OtpRateLimitedError.prototype);
  }
}

export class TooManyLoginAttemptsError extends AppError {
  constructor(message = 'Too many failed login attempts. Account temporarily locked.', details?: unknown) {
    super(ERROR_CODES.TOO_MANY_LOGIN_ATTEMPTS, message, 429, details);
    this.name = 'TooManyLoginAttemptsError';
    Object.setPrototypeOf(this, TooManyLoginAttemptsError.prototype);
  }
}

export class AccountBlockedError extends AppError {
  constructor(message = 'Account has been blocked', details?: unknown) {
    super(ERROR_CODES.ACCOUNT_BLOCKED, message, 403, details);
    this.name = 'AccountBlockedError';
    Object.setPrototypeOf(this, AccountBlockedError.prototype);
  }
}

export class AccountSuspendedError extends AppError {
  constructor(message = 'Account is suspended', details?: unknown) {
    super(ERROR_CODES.ACCOUNT_SUSPENDED, message, 403, details);
    this.name = 'AccountSuspendedError';
    Object.setPrototypeOf(this, AccountSuspendedError.prototype);
  }
}

export class AccountNotApprovedError extends AppError {
  constructor(message = 'Account is pending approval', details?: unknown) {
    super(ERROR_CODES.ACCOUNT_NOT_APPROVED, message, 403, details);
    this.name = 'AccountNotApprovedError';
    Object.setPrototypeOf(this, AccountNotApprovedError.prototype);
  }
}

export class MobileNotVerifiedError extends AppError {
  constructor(message = 'Mobile number has not been verified', details?: unknown) {
    super(ERROR_CODES.MOBILE_NOT_VERIFIED, message, 403, details);
    this.name = 'MobileNotVerifiedError';
    Object.setPrototypeOf(this, MobileNotVerifiedError.prototype);
  }
}

export class TokenExpiredError extends AppError {
  constructor(message = 'Session token has expired', details?: unknown) {
    super(ERROR_CODES.TOKEN_EXPIRED, message, 401, details);
    this.name = 'TokenExpiredError';
    Object.setPrototypeOf(this, TokenExpiredError.prototype);
  }
}

export class TokenInvalidError extends AppError {
  constructor(message = 'Invalid or malformed session token', details?: unknown) {
    super(ERROR_CODES.TOKEN_INVALID, message, 401, details);
    this.name = 'TokenInvalidError';
    Object.setPrototypeOf(this, TokenInvalidError.prototype);
  }
}

export class SessionRevokedError extends AppError {
  constructor(message = 'Session has been revoked or expired', details?: unknown) {
    super(ERROR_CODES.SESSION_REVOKED, message, 401, details);
    this.name = 'SessionRevokedError';
    Object.setPrototypeOf(this, SessionRevokedError.prototype);
  }
}

export class WeakPasswordError extends AppError {
  constructor(message = 'Password does not meet complexity requirements', details?: unknown) {
    super(ERROR_CODES.WEAK_PASSWORD, message, 422, details);
    this.name = 'WeakPasswordError';
    Object.setPrototypeOf(this, WeakPasswordError.prototype);
  }
}

export class EmailAlreadyRegisteredError extends AppError {
  constructor(message = 'Email address is already registered', details?: unknown) {
    super(ERROR_CODES.EMAIL_ALREADY_REGISTERED, message, 409, details);
    this.name = 'EmailAlreadyRegisteredError';
    Object.setPrototypeOf(this, EmailAlreadyRegisteredError.prototype);
  }
}

export class DuplicateRequestError extends AppError {
  constructor(message = 'Duplicate request detected', details?: unknown) {
    super(ERROR_CODES.CONFLICT, message, 409, details);
    this.name = 'DuplicateRequestError';
    Object.setPrototypeOf(this, DuplicateRequestError.prototype);
  }
}

export class ExternalServiceError extends AppError {
  constructor(message = 'External service failure', details?: unknown) {
    super(ERROR_CODES.INTERNAL_ERROR, message, 502, details);
    this.name = 'ExternalServiceError';
    Object.setPrototypeOf(this, ExternalServiceError.prototype);
  }
}

export class MobileAlreadyRegisteredError extends AppError {
  constructor(message = 'Mobile number is already registered', details?: unknown) {
    super(ERROR_CODES.MOBILE_ALREADY_REGISTERED, message, 409, details);
    this.name = 'MobileAlreadyRegisteredError';
    Object.setPrototypeOf(this, MobileAlreadyRegisteredError.prototype);
  }
}

