import { describe, it, expect, afterAll } from 'vitest';
import { PasswordService } from '../password.service.js';
import {
  TooManyLoginAttemptsError,
  WeakPasswordError,
} from '../../../shared/errors/index.js';
import { disconnectRedis } from '../../../shared/redis/index.js';

describe('PasswordService Unit Tests', () => {
  afterAll(async () => {
    await disconnectRedis();
  });

  it('hashes passwords using Argon2id with random salt', async () => {
    const pwd = 'ValidPassword123';
    const hash1 = await PasswordService.hash(pwd);
    const hash2 = await PasswordService.hash(pwd);

    expect(hash1).toMatch(/^\$argon2id\$/);
    expect(hash2).toMatch(/^\$argon2id\$/);
    expect(hash1).not.toBe(hash2);

    expect(await PasswordService.verify(pwd, hash1)).toBe(true);
    expect(await PasswordService.verify(pwd, hash2)).toBe(true);
    expect(await PasswordService.verify('WrongPassword123', hash1)).toBe(false);
  }, 15000);

  it('validates password policy and rejects weak or common passwords', () => {
    expect(() => PasswordService.validatePolicy('Short1')).toThrow(WeakPasswordError);
    expect(() => PasswordService.validatePolicy('123456789012')).toThrow(WeakPasswordError);
    expect(() => PasswordService.validatePolicy('OnlyLettersHere')).toThrow(WeakPasswordError);
    expect(() => PasswordService.validatePolicy('password123')).toThrow(WeakPasswordError);
    expect(() => PasswordService.validatePolicy('admin12345')).toThrow(WeakPasswordError);

    expect(() => PasswordService.validatePolicy('SecureP@ssw0rd2026')).not.toThrow();
  });

  it('tracks failed login attempts in Redis and locks account after threshold', async () => {
    const email = 'test-lockout-user@example.com';
    await PasswordService.clearFailedAttempts(email);

    // Record failures up to threshold
    for (let i = 0; i < 4; i++) {
      await PasswordService.recordFailedAttempt(email);
    }

    // 5th failure triggers lockout
    await expect(PasswordService.recordFailedAttempt(email)).rejects.toThrow(
      TooManyLoginAttemptsError,
    );

    // Lockout check throws
    await expect(PasswordService.checkLockout(email)).rejects.toThrow(
      TooManyLoginAttemptsError,
    );

    // Clear failed attempts resets lockout
    await PasswordService.clearFailedAttempts(email);
    await expect(PasswordService.checkLockout(email)).resolves.toBeUndefined();
  }, 15000);

  it('provides constant-time dummy verification for unknown emails to prevent timing attacks', async () => {
    const realHash = await PasswordService.hash('MySecretPassword123');

    const startReal = performance.now();
    await PasswordService.verify('WrongPasswordCheck', realHash);
    const realDuration = performance.now() - startReal;

    const startDummy = performance.now();
    await PasswordService.performDummyVerify('WrongPasswordCheck');
    const dummyDuration = performance.now() - startDummy;

    expect(realDuration).toBeGreaterThan(3);
    expect(dummyDuration).toBeGreaterThan(3);
  }, 15000);
});
