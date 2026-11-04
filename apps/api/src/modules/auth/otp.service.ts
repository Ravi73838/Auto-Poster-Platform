import crypto from 'node:crypto';
import {
  type OtpPurpose,
  type Language,
  SETTING_KEYS,
} from '@ap/shared-constants';
import { prisma } from '../../shared/db/index.js';
import { hashToken } from '../../shared/crypto/index.js';
import { SettingsService } from '../settings/settings.service.js';
import { getSmsProvider } from '../../integrations/sms/index.js';
import { getEmailProvider } from '../../integrations/email/index.js';
import { redisClient } from '../../shared/redis/index.js';
import {
  OtpInvalidError,
  OtpExpiredError,
  OtpTooManyAttemptsError,
  OtpRateLimitedError,
} from '../../shared/errors/index.js';
import { env } from '../../config/env.js';
import { logger } from '../../shared/logger/index.js';

export interface RequestOtpParams {
  target: string; // Mobile or email
  purpose: OtpPurpose;
  ipAddress?: string;
  language?: Language;
}

export interface VerifyOtpParams {
  target: string;
  purpose: OtpPurpose;
  code: string;
}

export class OtpService {
  /**
   * Generates a cryptographically secure numeric OTP string of given length.
   */
  static generateNumericOtp(length: number): string {
    const min = 10 ** (length - 1);
    const max = 10 ** length - 1;
    const num = crypto.randomInt(min, max + 1);
    return num.toString();
  }

  /**
   * Dispatches an OTP to a mobile phone or email target with rate limits and cooldowns.
   */
  static async requestOtp(params: RequestOtpParams): Promise<{ expiresAt: Date }> {
    const { target, purpose, ipAddress, language = 'en' } = params;

    // 1. IP-level rate limiting in Redis (if Redis is available)
    if (ipAddress && redisClient) {
      try {
        const ipKey = `rl:otp:ip:${ipAddress}`;
        const count = await redisClient.incr(ipKey);
        if (count === 1) {
          await redisClient.expire(ipKey, 3600); // 1 hour window
        }
        if (count > 25) {
          throw new OtpRateLimitedError('Too many verification requests from this IP address');
        }
      } catch (err) {
        if (err instanceof OtpRateLimitedError) throw err;
        logger.warn({ err }, 'Redis IP rate-check failed, continuing with DB checks');
      }
    }

    // 2. Fetch configurable settings
    const otpLength = await SettingsService.get(SETTING_KEYS.OTP_LENGTH).catch(() => 6);
    const ttlSeconds = await SettingsService.get(SETTING_KEYS.OTP_TTL_SECONDS).catch(() => 300);
    const maxAttempts = await SettingsService.get(SETTING_KEYS.OTP_MAX_ATTEMPTS).catch(() => 5);
    const cooldownSeconds = await SettingsService.get(SETTING_KEYS.OTP_RESEND_COOLDOWN_SECONDS).catch(() => 30);
    const dailyLimit = await SettingsService.get(SETTING_KEYS.OTP_DAILY_LIMIT_PER_TARGET).catch(() => 10);

    const now = new Date();

    // 3. Resend cooldown check (cooldownSeconds)
    const cooldownThreshold = new Date(now.getTime() - cooldownSeconds * 1000);
    const recentRequest = await prisma.otpRequest.findFirst({
      where: {
        mobile: target,
        purpose,
        createdAt: { gte: cooldownThreshold },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (recentRequest) {
      const remainingSeconds = Math.ceil(
        (recentRequest.createdAt.getTime() + cooldownSeconds * 1000 - now.getTime()) / 1000,
      );
      throw new OtpRateLimitedError(
        `Please wait ${remainingSeconds > 0 ? remainingSeconds : 1}s before requesting a new code`,
      );
    }

    // 4. Daily cap per target (rolling 24 hours)
    const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const dailyCount = await prisma.otpRequest.count({
      where: {
        mobile: target,
        createdAt: { gte: dayAgo },
      },
    });

    if (dailyCount >= dailyLimit) {
      throw new OtpRateLimitedError('Daily verification limit reached for this destination');
    }

    // 5. Generate and hash OTP
    const code = this.generateNumericOtp(otpLength);
    const tokenHash = hashToken(code);
    const expiresAt = new Date(now.getTime() + ttlSeconds * 1000);

    // 6. Record in database
    await prisma.otpRequest.create({
      data: {
        mobile: target,
        purpose,
        codeHash: tokenHash,
        expiresAt,
        maxAttempts,
      },
    });

    // 7. Dispatch via appropriate provider
    if (target.includes('@')) {
      await getEmailProvider().sendPasswordReset(target, code, language);
    } else {
      await getSmsProvider().sendOtp(target, code, language);
    }

    return { expiresAt };
  }

  /**
   * Verifies an OTP code using constant-time comparison.
   */
  static async verifyOtp(params: VerifyOtpParams): Promise<boolean> {
    const { target, purpose, code } = params;

    // Check dev bypass code (Strictly prohibited in production)
    if (
      env.NODE_ENV !== 'production' &&
      env.OTP_DEV_BYPASS_CODE &&
      env.OTP_DEV_BYPASS_CODE.trim().length > 0 &&
      code === env.OTP_DEV_BYPASS_CODE
    ) {
      logger.warn({ target, purpose }, '[DEV ONLY] Verified OTP using bypass code');
      // Mark any pending OTP request as consumed
      const activeOtp = await prisma.otpRequest.findFirst({
        where: { mobile: target, purpose, consumedAt: null },
        orderBy: { createdAt: 'desc' },
      });
      if (activeOtp) {
        await prisma.otpRequest.update({
          where: { id: activeOtp.id },
          data: { consumedAt: new Date() },
        });
      }
      return true;
    }

    // Retrieve latest unconsumed OTP request
    const record = await prisma.otpRequest.findFirst({
      where: {
        mobile: target,
        purpose,
        consumedAt: null,
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!record) {
      throw new OtpInvalidError('Invalid or expired verification code');
    }

    // Check expiry
    const now = new Date();
    if (now > record.expiresAt) {
      throw new OtpExpiredError('Verification code has expired');
    }

    // Check attempt threshold
    if (record.attempts >= record.maxAttempts) {
      throw new OtpTooManyAttemptsError('Maximum verification attempts exceeded');
    }

    // Constant-time hash verification
    const candidateHash = hashToken(code);
    const candidateBuf = Buffer.from(candidateHash, 'hex');
    const storedBuf = Buffer.from(record.codeHash, 'hex');

    const isValid =
      candidateBuf.length === storedBuf.length &&
      crypto.timingSafeEqual(candidateBuf, storedBuf);

    if (!isValid) {
      // Increment attempts counter
      const updated = await prisma.otpRequest.update({
        where: { id: record.id },
        data: { attempts: { increment: 1 } },
      });

      if (updated.attempts >= updated.maxAttempts) {
        throw new OtpTooManyAttemptsError('Maximum verification attempts exceeded');
      }

      throw new OtpInvalidError('Invalid verification code');
    }

    // Mark consumed (single use)
    await prisma.otpRequest.update({
      where: { id: record.id },
      data: { consumedAt: now },
    });

    return true;
  }
}
