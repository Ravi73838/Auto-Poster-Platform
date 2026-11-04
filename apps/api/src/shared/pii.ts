/**
 * Utility functions to mask Personally Identifiable Information (PII)
 * in admin-facing responses by default.
 */

export function maskPhone(phone?: string | null): string {
  if (!phone) return '';
  const cleaned = phone.trim();
  // +919876543210 or 9876543210
  if (cleaned.length >= 10) {
    const prefix = cleaned.slice(0, cleaned.startsWith('+91') ? 5 : 2);
    const suffix = cleaned.slice(-3);
    return `${prefix}*****${suffix}`;
  }
  return '*****';
}

export function maskEmail(email?: string | null): string {
  if (!email) return '';
  const cleaned = email.trim();
  const atIndex = cleaned.indexOf('@');
  if (atIndex <= 1) return '***@' + (cleaned.slice(atIndex + 1) || '***');

  const name = cleaned.slice(0, atIndex);
  const domain = cleaned.slice(atIndex);
  const visiblePrefix = name.slice(0, 1);
  const visibleSuffix = name.length > 3 ? name.slice(-1) : '';
  return `${visiblePrefix}***${visibleSuffix}${domain}`;
}

export function maskBankAccount(accountNumber?: string | null): string {
  if (!accountNumber) return '';
  const cleaned = accountNumber.trim();
  if (cleaned.length <= 4) return '****';
  const suffix = cleaned.slice(-4);
  return `${'*'.repeat(Math.max(4, cleaned.length - 4))}${suffix}`;
}

export function maskPan(pan?: string | null): string {
  if (!pan) return '';
  const cleaned = pan.trim();
  if (cleaned.length !== 10) return '*****';
  return `${cleaned.slice(0, 3)}****${cleaned.slice(-2)}`;
}

export function maskAadhaar(aadhaar?: string | null): string {
  if (!aadhaar) return '';
  const cleaned = aadhaar.replace(/\s+/g, '');
  if (cleaned.length < 4) return '**** **** ****';
  const suffix = cleaned.slice(-4);
  return `**** **** ${suffix}`;
}

export function maskGstin(gstin?: string | null): string {
  if (!gstin) return '';
  const cleaned = gstin.trim();
  if (cleaned.length !== 15) return '*****';
  return `${cleaned.slice(0, 3)}*****${cleaned.slice(-4)}`;
}

export function maskString(str?: string | null, keepStart = 1, keepEnd = 2): string {
  if (!str) return '';
  if (str.length <= keepStart + keepEnd) return '***';
  return `${str.slice(0, keepStart)}***${str.slice(-keepEnd)}`;
}
