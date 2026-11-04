import crypto from 'node:crypto';
import argon2 from 'argon2';
import { env } from '../../config/env.js';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // 96 bits recommended for GCM
const CURRENT_VERSION = 'v1';

function getEncryptionKey(): Buffer {
  const rawKey = env.ENCRYPTION_KEY;
  if (/^[0-9a-fA-F]{64}$/.test(rawKey)) {
    return Buffer.from(rawKey, 'hex');
  }
  const buf = Buffer.from(rawKey, 'utf-8');
  if (buf.length === 32) {
    return buf;
  }
  // If not 32 bytes, hash with SHA-256 to derive consistent 32-byte key
  return crypto.createHash('sha256').update(buf).digest();
}

/**
 * Encrypts plaintext using AES-256-GCM with versioned format:
 * v1:<ivHex>:<tagHex>:<ciphertextHex>
 */
export function encrypt(plaintext: string): string {
  const iv = crypto.randomBytes(IV_LENGTH);
  const key = getEncryptionKey();
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const tag = cipher.getAuthTag();

  return `${CURRENT_VERSION}:${iv.toString('hex')}:${tag.toString('hex')}:${encrypted}`;
}

/**
 * Decrypts a versioned AES-256-GCM ciphertext string.
 */
export function decrypt(ciphertext: string): string {
  const parts = ciphertext.split(':');
  if (parts.length !== 4) {
    throw new Error('Invalid encrypted payload format');
  }

  const [version, ivHex, tagHex, encryptedHex] = parts;

  if (version !== CURRENT_VERSION) {
    throw new Error(`Unsupported encryption version: ${version}`);
  }

  if (!ivHex || !tagHex || !encryptedHex) {
    throw new Error('Corrupted encrypted payload');
  }

  const iv = Buffer.from(ivHex, 'hex');
  const tag = Buffer.from(tagHex, 'hex');
  const key = getEncryptionKey();

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);

  let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

/**
 * Masks a UPI ID (e.g., 'driver1234@okaxis' -> 'xxxxxx1234@okaxis').
 */
export function maskUpi(upiId: string): string {
  const trimmed = upiId.trim();
  const atIndex = trimmed.indexOf('@');
  if (atIndex <= 0) {
    if (trimmed.length <= 4) return 'xxxx';
    return 'x'.repeat(trimmed.length - 4) + trimmed.slice(-4);
  }

  const handle = trimmed.slice(0, atIndex);
  const handleSuffix = trimmed.slice(atIndex);

  if (handle.length <= 4) {
    return `${'x'.repeat(handle.length)}${handleSuffix}`;
  }

  return `${'x'.repeat(handle.length - 4)}${handle.slice(-4)}${handleSuffix}`;
}

export const maskUpiId = maskUpi;

/**
 * Masks a bank account number (e.g., '123456789012' -> 'xxxxxxxx9012').
 */
export function maskBankAccount(accountNumber: string): string {
  const clean = accountNumber.trim();
  if (clean.length <= 4) {
    return 'xxxx';
  }
  return 'x'.repeat(clean.length - 4) + clean.slice(-4);
}

/**
 * Generates an HMAC-SHA256 hash of a token for secure lookup/storage.
 */
export function hashToken(token: string): string {
  return crypto.createHmac('sha256', env.HMAC_SECRET).update(token).digest('hex');
}

/**
 * Generates an HMAC-SHA256 fingerprint for duplicate detection without storing or revealing raw secrets.
 */
export function computeHmacFingerprint(value: string): string {
  return crypto.createHmac('sha256', env.HMAC_SECRET).update(value.trim()).digest('hex');
}

/**
 * Hashes a plain password using Argon2id.
 */
export async function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, {
    type: argon2.argon2id,
  });
}

/**
 * Verifies a password against an Argon2 hash.
 */
export async function verifyPassword(
  hash: string,
  password: string,
): Promise<boolean> {
  try {
    return await argon2.verify(hash, password);
  } catch {
    return false;
  }
}
