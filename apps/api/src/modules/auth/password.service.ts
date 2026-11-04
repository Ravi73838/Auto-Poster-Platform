import { SETTING_KEYS } from '@ap/shared-constants';
import { passwordSchema } from '@ap/shared-validation';
import { hashPassword, verifyPassword } from '../../shared/crypto/index.js';
import { SettingsService } from '../settings/settings.service.js';
import { redisClient } from '../../shared/redis/index.js';
import {
  TooManyLoginAttemptsError,
  WeakPasswordError,
} from '../../shared/errors/index.js';
import { logger } from '../../shared/logger/index.js';

// Pre-computed dummy Argon2id hash for constant-time anti-enumeration verification
// Hash of string 'DummyPasswordForTimingSafety123!'
const DUMMY_ARGON2_HASH =
  '$argon2id$v=19$m=65536,t=3,p=4$c29tZXNhbHQxMjM0NTY3OA$Ym25hU+aD2/U+L1yU9qA1cWfK3/h6Q17F7bX5k2d4oM';

export class PasswordService {
  /**
   * Validates a candidate password against the platform security policy.
   */
  static validatePolicy(password: string): void {
    const result = passwordSchema.safeParse(password);
    if (!result.success) {
      const issue = result.error.issues[0];
      throw new WeakPasswordError(issue?.message ?? 'Password does not meet complexity requirements');
    }
  }

  /**
   * Hashes a password using Argon2id.
   */
  static async hash(password: string): Promise<string> {
    this.validatePolicy(password);
    return hashPassword(password);
  }

  /**
   * Verifies a password against an Argon2id hash.
   */
  static async verify(password: string, hash: string): Promise<boolean> {
    return verifyPassword(hash, password);
  }

  /**
   * Performs a dummy password verification to neutralize timing side-channels
   * when an unknown email is supplied.
   */
  static async performDummyVerify(password: string): Promise<void> {
    try {
      await verifyPassword(DUMMY_ARGON2_HASH, password);
    } catch {
      // Ignored - dummy verification strictly consumes CPU cycles for timing equality
    }
  }

  /**
   * Checks if an account is locked due to excessive failed login attempts.
   */
  static async checkLockout(email: string): Promise<void> {
    if (!redisClient) return;

    try {
      const lockKey = `lockout:login:${email.toLowerCase().trim()}`;
      const isLocked = await redisClient.get(lockKey);
      if (isLocked) {
        throw new TooManyLoginAttemptsError(
          'Too many failed login attempts. Your account has been temporarily locked.',
        );
      }
    } catch (err) {
      if (err instanceof TooManyLoginAttemptsError) throw err;
      logger.warn({ err }, 'Redis lockout check encountered error, failing open');
    }
  }

  /**
   * Records a failed login attempt and locks account if threshold is exceeded.
   */
  static async recordFailedAttempt(email: string): Promise<void> {
    if (!redisClient) return;

    const normalized = email.toLowerCase().trim();
    const failKey = `fail:login:${normalized}`;
    const lockKey = `lockout:login:${normalized}`;

    try {
      const maxFailures = await SettingsService.get(SETTING_KEYS.LOGIN_MAX_FAILURES).catch(() => 5);
      const lockMinutes = await SettingsService.get(SETTING_KEYS.LOGIN_LOCK_MINUTES).catch(() => 15);

      const count = await redisClient.incr(failKey);
      if (count === 1) {
        await redisClient.expire(failKey, lockMinutes * 60);
      }

      if (count >= maxFailures) {
        await redisClient.set(lockKey, 'locked', 'EX', lockMinutes * 60);
        await redisClient.del(failKey);
        throw new TooManyLoginAttemptsError(
          `Too many failed login attempts. Account locked for ${lockMinutes} minutes.`,
        );
      }
    } catch (err) {
      if (err instanceof TooManyLoginAttemptsError) throw err;
      logger.warn({ err }, 'Redis failed attempt recording error');
    }
  }

  /**
   * Clears failure counters upon successful login.
   */
  static async clearFailedAttempts(email: string): Promise<void> {
    if (!redisClient) return;

    const normalized = email.toLowerCase().trim();
    try {
      await redisClient.del(`fail:login:${normalized}`, `lockout:login:${normalized}`);
    } catch (err) {
      logger.warn({ err }, 'Failed to clear login attempts in Redis');
    }
  }
}

