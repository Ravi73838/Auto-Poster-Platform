import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { isRecipientAllowlisted } from '../allowlist.js';
import { env } from '../../../config/env.js';

describe('Notification Allowlist', () => {
  const originalEnv = { ...env };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    Object.assign(env, originalEnv);
  });

  it('allows all recipients in production environment', () => {
    (env as any).DB_ENVIRONMENT = 'production';
    (env as any).notifyAllowlist = [];

    expect(isRecipientAllowlisted('+919876543210')).toBe(true);
    expect(isRecipientAllowlisted('user@example.com')).toBe(true);
    expect(isRecipientAllowlisted('random@domain.com')).toBe(true);
  });

  it('rejects all recipients when allowlist is empty in development/staging', () => {
    (env as any).DB_ENVIRONMENT = 'development';
    (env as any).notifyAllowlist = [];

    expect(isRecipientAllowlisted('+919876543210')).toBe(false);
    expect(isRecipientAllowlisted('user@example.com')).toBe(false);

    (env as any).DB_ENVIRONMENT = 'staging';
    expect(isRecipientAllowlisted('+919876543210')).toBe(false);
  });

  it('rejects invalid or empty recipient strings', () => {
    (env as any).DB_ENVIRONMENT = 'staging';
    (env as any).notifyAllowlist = ['+919876543210', 'admin@autoposter.com'];

    expect(isRecipientAllowlisted('')).toBe(false);
    expect(isRecipientAllowlisted(null as any)).toBe(false);
    expect(isRecipientAllowlisted(undefined as any)).toBe(false);
  });

  it('allows matching phone numbers with or without country code and formatting', () => {
    (env as any).DB_ENVIRONMENT = 'staging';
    (env as any).notifyAllowlist = ['+919876543210', '8888888888'];

    // Exact match
    expect(isRecipientAllowlisted('+919876543210')).toBe(true);
    // Formatted match
    expect(isRecipientAllowlisted('+91 98765-43210')).toBe(true);
    // Suffix match (without +91)
    expect(isRecipientAllowlisted('9876543210')).toBe(true);
    // With 8888888888
    expect(isRecipientAllowlisted('+918888888888')).toBe(true);

    // Non-matching phone
    expect(isRecipientAllowlisted('+919999999999')).toBe(false);
  });

  it('allows matching emails case-insensitively', () => {
    (env as any).DB_ENVIRONMENT = 'development';
    (env as any).notifyAllowlist = ['test.user@autoposter.com'];

    expect(isRecipientAllowlisted('test.user@autoposter.com')).toBe(true);
    expect(isRecipientAllowlisted('TEST.USER@AUTOPOSTER.COM')).toBe(true);
    expect(isRecipientAllowlisted('  test.user@autoposter.com  ')).toBe(true);

    // Non-matching email
    expect(isRecipientAllowlisted('other@autoposter.com')).toBe(false);
  });
});

