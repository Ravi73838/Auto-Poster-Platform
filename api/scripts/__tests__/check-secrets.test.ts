import { describe, it, expect } from 'vitest';
import { scanContent, isPlaceholder } from '../check-secrets.js';

describe('check-secrets', () => {
  it('correctly identifies placeholder values', () => {
    expect(isPlaceholder('YOUR_PASSWORD')).toBe(true);
    expect(isPlaceholder('postgres:postgres')).toBe(true);
    expect(isPlaceholder('test-secret')).toBe(true);
    expect(isPlaceholder('change-me-later')).toBe(true);
    expect(isPlaceholder('randomSuperSecretValue1234567890ABCDEF')).toBe(false);
  });

  it('detects private key headers', () => {
    const content = `const key = "-----BEGIN RSA PRIVATE KEY-----\\nMIIEowIBAAKCAQEA0...";`;
    const findings = scanContent(content, 'test-file.ts');
    expect(findings.length).toBe(1);
    expect(findings[0]?.rule).toContain('Private key');
  });

  it('detects AWS access keys', () => {
    // Synthetic non-placeholder AWS key
    const content = `const awsKey = "AKIA1234567890ABCDEF";`;
    const findings = scanContent(content, 'config.ts');
    expect(findings.length).toBe(1);
    expect(findings[0]?.rule).toContain('AWS Access Key');
  });

  it('ignores placeholder AWS keys', () => {
    const content = `const awsKey = "AKIAIOSFODNN7EXAMPLE";`;
    const findings = scanContent(content, 'config.ts');
    expect(findings.length).toBe(0);
  });

  it('detects database connection string with credentials', () => {
    const content = `const dbUrl = "postgresql://myuser:supersecretpass123@prod-db.example.com:5432/main";`;
    const findings = scanContent(content, 'db.ts');
    expect(findings.length).toBe(1);
    expect(findings[0]?.rule).toContain('Database connection string');
  });

  it('ignores database connection strings with placeholder credentials', () => {
    const content = `const dbUrl = "postgresql://postgres:postgres@localhost:5432/test";`;
    const findings = scanContent(content, 'db.ts');
    expect(findings.length).toBe(0);
  });

  it('detects high-entropy secret assignment', () => {
    const content = `export const JWT_SECRET = "9a8f7b6c5d4e3f2a1b0c9d8e7f6a5b4c";`;
    const findings = scanContent(content, 'auth.ts');
    expect(findings.length).toBe(1);
    expect(findings[0]?.rule).toContain('High-entropy');
  });

  it('ignores placeholder secret assignment', () => {
    const content = `export const JWT_SECRET = "dummy-jwt-secret-placeholder-value";`;
    const findings = scanContent(content, 'auth.ts');
    expect(findings.length).toBe(0);
  });
});
