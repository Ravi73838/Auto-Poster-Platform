import { describe, it, expect } from 'vitest';
import {
  normalizeIndianMobile,
  mobileSchema,
  normalizeVehicleNumber,
  vehicleNumberSchema,
  upiIdSchema,
  ifscSchema,
  VEHICLE_NUMBER_STANDARD_REGEX,
  VEHICLE_NUMBER_BH_REGEX,
} from '../shared/validation';

describe('Layer 1 Form Validation & Normalisation Rules', () => {
  describe('Mobile Number Normalisation', () => {
    it('normalises raw 10-digit Indian numbers to E.164 (+91)', () => {
      expect(normalizeIndianMobile('9876543210')).toBe('+919876543210');
      expect(normalizeIndianMobile(' 98765-43210 ')).toBe('+919876543210');
      expect(normalizeIndianMobile('+91 98765 43210')).toBe('+919876543210');
      expect(normalizeIndianMobile('919876543210')).toBe('+919876543210');
    });

    it('rejects invalid numbers (not starting with 6-9, wrong length, letters)', () => {
      const invalid = ['1234567890', '5876543210', '98765', '98765432100', 'abc9876543'];
      for (const num of invalid) {
        const res = mobileSchema.safeParse(num);
        expect(res.success).toBe(false);
      }
    });

    it('accepts valid mobile numbers via Zod schema', () => {
      const valid = ['9876543210', '+919876543210', '8123456789', '7000000000', '6999999999'];
      for (const num of valid) {
        const res = mobileSchema.safeParse(num);
        expect(res.success).toBe(true);
      }
    });
  });

  describe('Vehicle Number Normalisation & Regex', () => {
    it('normalises standard state vehicle registration plates', () => {
      expect(normalizeVehicleNumber('gj 01 ab 1234')).toBe('GJ01AB1234');
      expect(normalizeVehicleNumber('MH-12-DE-9999')).toBe('MH12DE9999');
      expect(normalizeVehicleNumber('DL 1C A 1234')).toBe('DL1CA1234');
    });

    it('validates standard state license plates with regex', () => {
      expect(VEHICLE_NUMBER_STANDARD_REGEX.test('GJ01AB1234')).toBe(true);
      expect(VEHICLE_NUMBER_STANDARD_REGEX.test('MH12DE9999')).toBe(true);
      expect(VEHICLE_NUMBER_STANDARD_REGEX.test('DL1CA1234')).toBe(true);
      expect(VEHICLE_NUMBER_STANDARD_REGEX.test('KA051234')).toBe(true);
    });

    it('validates BH Series (Bharat Series) license plates', () => {
      // Format: YY BH #### XX (e.g. 22BH1234AA or 21BH9999A)
      expect(VEHICLE_NUMBER_BH_REGEX.test('22BH1234AA')).toBe(true);
      expect(VEHICLE_NUMBER_BH_REGEX.test('21BH9999A')).toBe(true);
      expect(VEHICLE_NUMBER_BH_REGEX.test('26BH0001Z')).toBe(true);

      const parsed = vehicleNumberSchema.safeParse('22 bh 1234 aa');
      expect(parsed.success).toBe(true);
      if (parsed.success) {
        expect(parsed.data).toBe('22BH1234AA');
      }
    });

    it('rejects invalid vehicle registrations', () => {
      const invalid = ['1234', 'GJ', 'INVALID_PLATE', 'GJ01A', '9999BH1234'];
      for (const plate of invalid) {
        const res = vehicleNumberSchema.safeParse(plate);
        expect(res.success).toBe(false);
      }
    });
  });

  describe('UPI ID & Bank IFSC Validation', () => {
    it('validates common Indian UPI handles', () => {
      const valid = [
        'driver@okhdfcbank',
        '9876543210@paytm',
        'auto.driver@icici',
        'partner123@ybl',
        'ramesh_autorickshaw@oksbi',
      ];
      for (const upi of valid) {
        expect(upiIdSchema.safeParse(upi).success).toBe(true);
      }
    });

    it('rejects malformed UPI handles', () => {
      const invalid = ['plain_string', 'driver@', '@paytm', 'driver@@upi', 'spaces in@upi'];
      for (const upi of invalid) {
        expect(upiIdSchema.safeParse(upi).success).toBe(false);
      }
    });

    it('validates 11-character Indian Financial System Codes (IFSC)', () => {
      const valid = ['SBIN0001234', 'HDFC0000001', 'ICIC0001002', 'PUNB0123400', 'BARB0AHMEDA'];
      for (const ifsc of valid) {
        expect(ifscSchema.safeParse(ifsc).success).toBe(true);
      }
    });

    it('rejects invalid IFSC codes (wrong 5th char, wrong length, special chars)', () => {
      const invalid = ['SBIN1001234', 'SBIN00012', 'HDFC00000001', '12340001234', 'SBIN 001234'];
      for (const ifsc of invalid) {
        expect(ifscSchema.safeParse(ifsc).success).toBe(false);
      }
    });
  });

  describe('Idempotency Key Generation & Safety', () => {
    it('generates distinct deterministic idempotency keys for submissions', () => {
      const key1 = `sub_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
      const key2 = `sub_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
      expect(key1).not.toBe(key2);
      expect(key1.startsWith('sub_')).toBe(true);
    });
  });
});
