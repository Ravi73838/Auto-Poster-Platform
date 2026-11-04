import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '../../../shared/db/index.js';
import { OtpService } from '../otp.service.js';
import { OTP_PURPOSES } from '@ap/shared-constants';
import {
  OtpInvalidError,
  OtpExpiredError,
  OtpTooManyAttemptsError,
  OtpRateLimitedError,
} from '../../../shared/errors/index.js';
import { disconnectRedis } from '../../../shared/redis/index.js';

describe('OtpService Unit & Flow Tests', () => {
  beforeAll(async () => {
    await prisma.$executeRawUnsafe(`TRUNCATE TABLE "otp_requests" CASCADE;`);
  });

  afterAll(async () => {
    await disconnectRedis();
  });

  it('generates cryptographic numeric codes of requested length', () => {
    const code6 = OtpService.generateNumericOtp(6);
    expect(code6).toMatch(/^\d{6}$/);

    const code4 = OtpService.generateNumericOtp(4);
    expect(code4).toMatch(/^\d{4}$/);
  });

  it('creates and verifies an OTP request successfully', async () => {
    const target = '+919988776655';
    const purpose = OTP_PURPOSES.LOGIN;

    const { expiresAt } = await OtpService.requestOtp({
      target,
      purpose,
      ipAddress: '127.0.0.1',
    });

    expect(expiresAt).toBeDefined();

    // Verify using dev bypass code
    const verified = await OtpService.verifyOtp({
      target,
      purpose,
      code: '123456',
    });

    expect(verified).toBe(true);

    // Consumed or non-matching code cannot be verified
    await expect(
      OtpService.verifyOtp({
        target,
        purpose,
        code: '999999',
      }),
    ).rejects.toThrow(OtpInvalidError);
  });

  it('enforces cooldown period between consecutive requests', async () => {
    const target = '+919988776656';
    const purpose = OTP_PURPOSES.LOGIN;

    await OtpService.requestOtp({
      target,
      purpose,
      ipAddress: '127.0.0.1',
    });

    // Immediate second request should be rejected by cooldown
    await expect(
      OtpService.requestOtp({
        target,
        purpose,
        ipAddress: '127.0.0.1',
      }),
    ).rejects.toThrow(OtpRateLimitedError);
  });

  it('tracks failed attempts and invalidates after max attempts', async () => {
    const target = '+919988776657';
    const purpose = OTP_PURPOSES.LOGIN;

    await OtpService.requestOtp({
      target,
      purpose,
      ipAddress: '127.0.0.1',
    });

    // Attempt 1 with wrong code
    await expect(
      OtpService.verifyOtp({ target, purpose, code: '000000' }),
    ).rejects.toThrow(OtpInvalidError);

    // Attempt 2
    await expect(
      OtpService.verifyOtp({ target, purpose, code: '000001' }),
    ).rejects.toThrow(OtpInvalidError);

    // Attempt 3
    await expect(
      OtpService.verifyOtp({ target, purpose, code: '000002' }),
    ).rejects.toThrow(OtpInvalidError);

    // Attempt 4
    await expect(
      OtpService.verifyOtp({ target, purpose, code: '000003' }),
    ).rejects.toThrow(OtpInvalidError);

    // Attempt 5 -> reaches max attempts
    await expect(
      OtpService.verifyOtp({ target, purpose, code: '000004' }),
    ).rejects.toThrow(OtpTooManyAttemptsError);
  });

  it('rejects expired OTP requests', async () => {
    const target = '+919988776658';
    const purpose = OTP_PURPOSES.LOGIN;

    await OtpService.requestOtp({
      target,
      purpose,
      ipAddress: '127.0.0.1',
    });

    // Artificially expire the OTP record in the database
    await prisma.otpRequest.updateMany({
      where: { mobile: target, purpose },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });

    await expect(
      OtpService.verifyOtp({
        target,
        purpose,
        code: '999999',
      }),
    ).rejects.toThrow(OtpExpiredError);
  });

  it('supports dev bypass code outside production', async () => {
    const target = '+919988776659';
    const purpose = OTP_PURPOSES.LOGIN;

    await OtpService.requestOtp({
      target,
      purpose,
      ipAddress: '127.0.0.1',
    });

    // 123456 is the dev bypass code configured in .env
    const verified = await OtpService.verifyOtp({
      target,
      purpose,
      code: '123456',
    });

    expect(verified).toBe(true);
  });
});
