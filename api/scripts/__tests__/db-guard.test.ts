import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { assertDbGuard, maskDatabaseHost, extractSchemaFromUrl } from '../db-guard.js';

describe('db-guard', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('masks database host correctly', () => {
    expect(maskDatabaseHost('postgresql://user:pass@db.wqpvvjtfoqgiecsykjrk.supabase.co:5432/postgres')).toBe(
      'db.w...supabase.co',
    );
    expect(maskDatabaseHost('localhost')).toBe('localhost');
  });

  it('extracts schema from URL correctly', () => {
    expect(extractSchemaFromUrl('postgresql://user:pass@host:5432/db?schema=test')).toBe('test');
    expect(extractSchemaFromUrl('postgresql://user:pass@host:5432/db?schema=perf&connection_limit=5')).toBe('perf');
    expect(extractSchemaFromUrl('postgresql://user:pass@host:5432/db')).toBe('public');
  });

  it('refuses when DB_ENVIRONMENT is not set', () => {
    delete process.env.DB_ENVIRONMENT;
    process.env.NODE_ENV = 'development';
    expect(() => assertDbGuard('seed:demo')).toThrow(/DB_ENVIRONMENT is not set/);
  });

  it('refuses destructive operations when DB_ENVIRONMENT=production', () => {
    process.env.DB_ENVIRONMENT = 'production';
    process.env.NODE_ENV = 'production';
    expect(() => assertDbGuard('seed:demo')).toThrow(/strictly PROHIBITED when DB_ENVIRONMENT="production"/);
    expect(() => assertDbGuard('test')).toThrow(/strictly PROHIBITED when DB_ENVIRONMENT="production"/);
  });

  it('refuses operations when NODE_ENV=production in development mode', () => {
    process.env.DB_ENVIRONMENT = 'development';
    process.env.NODE_ENV = 'production';
    expect(() => assertDbGuard('seed:demo')).toThrow(/cannot run when NODE_ENV="production"/);
  });

  it('enforces schema rules: test target cannot target public schema', () => {
    process.env.DB_ENVIRONMENT = 'development';
    process.env.NODE_ENV = 'test';
    expect(() => assertDbGuard('test', { targetSchema: 'public' })).toThrow(
      /Test operations may ONLY target schema "test"/,
    );
    expect(() => assertDbGuard('test', { targetSchema: 'test' })).not.toThrow();
  });

  it('enforces schema rules: load/perf target cannot target public schema', () => {
    process.env.DB_ENVIRONMENT = 'development';
    process.env.NODE_ENV = 'development';
    expect(() => assertDbGuard('seed:load', { targetSchema: 'public' })).toThrow(
      /Performance\/load operations may ONLY target schema "perf"/,
    );
    expect(() => assertDbGuard('seed:load', { targetSchema: 'perf' })).not.toThrow();
  });

  it('enforces schema rules: seed:demo must target public schema', () => {
    process.env.DB_ENVIRONMENT = 'development';
    process.env.NODE_ENV = 'development';
    expect(() => assertDbGuard('seed:demo', { targetSchema: 'test' })).toThrow(
      /Base and demo seeds may only target schema "public"/,
    );
    expect(() => assertDbGuard('seed:demo', { targetSchema: 'public' })).not.toThrow();
  });

  it('enforces staging rules: permits rehearsal, gameday, e2e seeds, but prohibits demo seeds', () => {
    process.env.DB_ENVIRONMENT = 'staging';
    process.env.NODE_ENV = 'development';

    expect(() => assertDbGuard('rehearsal')).not.toThrow();
    expect(() => assertDbGuard('gameday')).not.toThrow();
    expect(() => assertDbGuard('seed:e2e')).not.toThrow();
    expect(() => assertDbGuard('seed:base', { targetSchema: 'public' })).not.toThrow();
    expect(() => assertDbGuard('seed:demo')).toThrow(/PROHIBITED when DB_ENVIRONMENT="staging"/);
    expect(() => assertDbGuard('seed:load')).toThrow(/PROHIBITED when DB_ENVIRONMENT="staging"/);
  });

  it('allows valid combinations', () => {
    process.env.DB_ENVIRONMENT = 'development';
    process.env.NODE_ENV = 'development';
    expect(() => assertDbGuard('seed:demo', { targetSchema: 'public' })).not.toThrow();
    expect(() => assertDbGuard('migrate', { targetSchema: 'verify_tmp' })).not.toThrow();
  });
});

