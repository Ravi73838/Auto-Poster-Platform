import { describe, it, expect } from 'vitest';
import {
  encrypt,
  decrypt,
  maskUpi,
  maskBankAccount,
  hashToken,
  hashPassword,
  verifyPassword,
} from '../index.js';

describe('shared/crypto', () => {
  describe('AES-256-GCM encrypt & decrypt', () => {
    it('encrypts and decrypts text correctly (round-trip)', () => {
      const plaintext = 'rajesh.patel@okicici';
      const ciphertext = encrypt(plaintext);

      expect(ciphertext).toMatch(/^v1:[0-9a-f]{24}:[0-9a-f]{32}:[0-9a-f]+$/);
      expect(ciphertext).not.toBe(plaintext);

      const decrypted = decrypt(ciphertext);
      expect(decrypted).toBe(plaintext);
    });

    it('produces different ciphertexts for identical plaintext (unique IV)', () => {
      const plaintext = 'secret-data';
      const c1 = encrypt(plaintext);
      const c2 = encrypt(plaintext);

      expect(c1).not.toBe(c2);
      expect(decrypt(c1)).toBe(plaintext);
      expect(decrypt(c2)).toBe(plaintext);
    });

    it('throws when ciphertext has been tampered with', () => {
      const ciphertext = encrypt('sensitive-bank-account');
      const parts = ciphertext.split(':');
      // Tamper with the encrypted bytes
      parts[3] = parts[3]!.replace(/[0-9a-f]/, '0');
      const tampered = parts.join(':');

      expect(() => decrypt(tampered)).toThrow();
    });

    it('throws on invalid format', () => {
      expect(() => decrypt('not-a-valid-encrypted-string')).toThrow(
        'Invalid encrypted payload format',
      );
    });
  });

  describe('maskUpi', () => {
    it('masks UPI ID correctly preserving domain and last 4 handle characters', () => {
      expect(maskUpi('driver1234@okaxis')).toBe('xxxxxx1234@okaxis');
      expect(maskUpi('rameshkumar98@okaxis')).toBe('xxxxxxxxxar98@okaxis');
      expect(maskUpi('driver@upi')).toBe('xxiver@upi');
      expect(maskUpi('abc@ybl')).toBe('xxx@ybl');
    });

    it('handles non-email UPI IDs gracefully', () => {
      expect(maskUpi('9876543210')).toBe('xxxxxx3210');
      expect(maskUpi('123')).toBe('xxxx');
    });
  });

  describe('maskBankAccount', () => {
    it('masks bank account preserving only the last 4 digits', () => {
      expect(maskBankAccount('123456789012')).toBe('xxxxxxxx9012');
      expect(maskBankAccount('50100456789123')).toBe('xxxxxxxxxx9123');
      expect(maskBankAccount('1234')).toBe('xxxx');
    });
  });

  describe('hashToken', () => {
    it('produces deterministic HMAC-SHA256 hex string', () => {
      const token = 'sample-session-token-xyz';
      const h1 = hashToken(token);
      const h2 = hashToken(token);

      expect(h1).toHaveLength(64);
      expect(h1).toBe(h2);
      expect(hashToken('different-token')).not.toBe(h1);
    });
  });

  describe('Argon2 password hashing', () => {
    it('hashes and verifies passwords correctly', async () => {
      const password = 'SuperSecretPassword123!';
      const hash = await hashPassword(password);

      expect(hash).toContain('$argon2');
      expect(await verifyPassword(hash, password)).toBe(true);
      expect(await verifyPassword(hash, 'WrongPassword123!')).toBe(false);
    });
  });
});
