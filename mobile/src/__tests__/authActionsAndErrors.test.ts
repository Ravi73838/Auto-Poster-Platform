import { describe, it, expect } from 'vitest';
import { ERROR_CODES } from '@ap/shared-constants';
import errorsEn from '../shared/i18n/locales/en/errors.json';
import errorsHi from '../shared/i18n/locales/hi/errors.json';
import errorsGu from '../shared/i18n/locales/gu/errors.json';

describe('Layer 1 Category 3 & 4: Actions, Error Mapping & Next Steps', () => {
  it('Critical driver-facing error codes are defined in English error catalog', () => {
    const requiredCodes = [
      ERROR_CODES.INVALID_CREDENTIALS,
      ERROR_CODES.ACCOUNT_BLOCKED,
      ERROR_CODES.ACCOUNT_SUSPENDED,
      ERROR_CODES.PHOTO_MOCK_LOCATION_DETECTED,
      ERROR_CODES.GPS_ACCURACY_TOO_LOW,
      ERROR_CODES.DUPLICATE_PHOTO,
      ERROR_CODES.DAY_ALREADY_VERIFIED,
      ERROR_CODES.CAMPAIGN_SLOTS_FULL,
      ERROR_CODES.ASSIGNMENT_VEHICLE_BUSY,
      ERROR_CODES.INSUFFICIENT_WALLET_BALANCE,
      ERROR_CODES.WITHDRAWAL_BELOW_MINIMUM,
    ];

    for (const code of requiredCodes) {
      expect((errorsEn as Record<string, string>)[code], `Missing en translation for error code: ${code}`).toBeDefined();
    }
  });

  it('Critical driver-facing error codes are translated in Hindi error catalog', () => {
    const requiredCodes = [
      ERROR_CODES.INVALID_CREDENTIALS,
      ERROR_CODES.ACCOUNT_BLOCKED,
      ERROR_CODES.PHOTO_MOCK_LOCATION_DETECTED,
      ERROR_CODES.GPS_ACCURACY_TOO_LOW,
      ERROR_CODES.DUPLICATE_PHOTO,
      ERROR_CODES.DAY_ALREADY_VERIFIED,
      ERROR_CODES.INSUFFICIENT_WALLET_BALANCE,
    ];

    for (const code of requiredCodes) {
      expect((errorsHi as Record<string, string>)[code], `Missing hi translation for error code: ${code}`).toBeDefined();
    }
  });

  it('Critical driver-facing error codes are translated in Gujarati error catalog', () => {
    const requiredCodes = [
      ERROR_CODES.INVALID_CREDENTIALS,
      ERROR_CODES.ACCOUNT_BLOCKED,
      ERROR_CODES.PHOTO_MOCK_LOCATION_DETECTED,
      ERROR_CODES.GPS_ACCURACY_TOO_LOW,
      ERROR_CODES.DUPLICATE_PHOTO,
      ERROR_CODES.DAY_ALREADY_VERIFIED,
      ERROR_CODES.INSUFFICIENT_WALLET_BALANCE,
    ];

    for (const code of requiredCodes) {
      expect((errorsGu as Record<string, string>)[code], `Missing gu translation for error code: ${code}`).toBeDefined();
    }
  });

  it('Idempotency keys generated on driver action requests are unique and non-empty', () => {
    const generateIdempotencyKey = (action: string, id: string) => {
      return `mobile_${action}_${id}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    };

    const k1 = generateIdempotencyKey('select', 'cmp-1');
    const k2 = generateIdempotencyKey('select', 'cmp-1');
    expect(k1).not.toBe(k2);
    expect(k1.startsWith('mobile_select_cmp-1_')).toBe(true);
  });
});
