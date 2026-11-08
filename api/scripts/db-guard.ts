/**
 * Database Environment & Schema Guard
 * Protects databases against unintended destructive operations or schema violations.
 */

export type ScriptTarget =
  | 'migrate'
  | 'deploy'
  | 'seed:base'
  | 'seed:demo'
  | 'seed:e2e'
  | 'seed:load'
  | 'test'
  | 'perf'
  | 'drop:perf'
  | 'rehearsal'
  | 'gameday'
  | 'cleanup:go-live';

export interface GuardOptions {
  targetSchema?: string;
  connectionUrl?: string;
  allowProductionCleanup?: boolean;
}

/**
 * Converts an IPv6-only Supabase direct host (db.<ref>.supabase.co)
 * to the IPv4-compatible Supabase connection pooler host (port 5432 session mode).
 */
export function toReachableSupabaseUrl(rawUrl: string): string {
  try {
    const u = new URL(rawUrl);
    if (u.hostname.startsWith('db.') && u.hostname.endsWith('.supabase.co')) {
      const parts = u.hostname.split('.');
      const ref = parts[1]!;
      u.hostname = 'aws-0-ap-northeast-1.pooler.supabase.com';
      u.username = `postgres.${ref}`;
      u.port = '5432';
      return u.toString();
    }
  } catch {
    // ignore
  }
  return rawUrl;
}

/**
 * Masks a database host so it is safe to print in logs and prompts without exposing
 * the full project reference.
 */
export function maskDatabaseHost(rawUrlOrHost: string): string {
  let hostname = rawUrlOrHost;
  try {
    if (rawUrlOrHost.includes('://')) {
      const parsed = new URL(rawUrlOrHost);
      hostname = parsed.hostname;
    }
  } catch {
    // If not a full URL, treat as hostname
  }

  if (hostname.length <= 9 || !hostname.includes('.')) {
    return hostname;
  }

  const parts = hostname.split('.');
  if (parts.length >= 3) {
    const domainSuffix = parts.slice(-2).join('.');
    const prefix = hostname.slice(0, 4);
    return `${prefix}...${domainSuffix}`;
  }

  return `${hostname.slice(0, 4)}...${hostname.slice(-4)}`;
}

/**
 * Extracts the target schema from a PostgreSQL connection string
 */
export function extractSchemaFromUrl(urlStr: string): string {
  try {
    const url = new URL(urlStr);
    return url.searchParams.get('schema') || 'public';
  } catch {
    const match = urlStr.match(/[?&]schema=([a-zA-Z0-9_-]+)/);
    return match ? match[1]! : 'public';
  }
}

/**
 * Evaluates DB guard policy and throws an Error with a descriptive refusal message if violated.
 */
export function assertDbGuard(target: ScriptTarget, options?: GuardOptions): void {
  const dbEnv = process.env.DB_ENVIRONMENT;
  const nodeEnv = process.env.NODE_ENV;

  // 1. Check DB_ENVIRONMENT requirement
  if (!dbEnv) {
    throw new Error(
      `[DB GUARD REFUSAL] DB_ENVIRONMENT is not set. All database scripts require DB_ENVIRONMENT="development", "staging", or "production".`,
    );
  }

  const validEnvironments = ['development', 'staging', 'production'];
  if (!validEnvironments.includes(dbEnv)) {
    throw new Error(
      `[DB GUARD REFUSAL] Unrecognized DB_ENVIRONMENT "${dbEnv}". Must be "development", "staging", or "production".`,
    );
  }

  // 2. Production Environment Restrictions
  if (dbEnv === 'production') {
    if (target === 'deploy' || target === 'seed:base') {
      return;
    }
    if (target === 'cleanup:go-live' && options?.allowProductionCleanup) {
      return;
    }
    throw new Error(
      `[DB GUARD REFUSAL] Operation "${target}" is strictly PROHIBITED when DB_ENVIRONMENT="production".`,
    );
  }

  // 3. Staging Environment Restrictions
  if (dbEnv === 'staging') {
    const allowedStagingTargets: ScriptTarget[] = [
      'deploy',
      'seed:base',
      'seed:e2e',
      'rehearsal',
      'gameday',
      'test',
      'cleanup:go-live',
    ];
    if (!allowedStagingTargets.includes(target)) {
      throw new Error(
        `[DB GUARD REFUSAL] Operation "${target}" is PROHIBITED when DB_ENVIRONMENT="staging". Staging permits: ${allowedStagingTargets.join(', ')}.`,
      );
    }
  }

  // 4. Seed rules per environment
  if (target === 'seed:demo' && dbEnv !== 'development') {
    throw new Error(
      `[DB GUARD REFUSAL] "seed:demo" is strictly limited to development databases (DB_ENVIRONMENT="development"). Current DB_ENVIRONMENT="${dbEnv}".`,
    );
  }

  // 5. Prohibit execution if NODE_ENV is production (unless target is deploy or seed:base)
  if (nodeEnv === 'production' && target !== 'deploy' && target !== 'seed:base') {
    throw new Error(
      `[DB GUARD REFUSAL] Operation "${target}" cannot run when NODE_ENV="production".`,
    );
  }

  // 4. Schema Targeting Rules
  const connectionUrl = options?.connectionUrl || process.env.DATABASE_URL || '';
  const schema = options?.targetSchema || (connectionUrl ? extractSchemaFromUrl(connectionUrl) : 'public');

  switch (target) {
    case 'test': {
      if (schema !== 'test') {
        throw new Error(
          `[DB GUARD REFUSAL] Test operations may ONLY target schema "test". Attempted to target schema "${schema}".`,
        );
      }
      break;
    }
    case 'seed:load':
    case 'perf':
    case 'drop:perf': {
      if (schema !== 'perf') {
        throw new Error(
          `[DB GUARD REFUSAL] Performance/load operations may ONLY target schema "perf". Attempted to target schema "${schema}".`,
        );
      }
      break;
    }
    case 'seed:base':
    case 'seed:demo': {
      if (schema !== 'public') {
        throw new Error(
          `[DB GUARD REFUSAL] Base and demo seeds may only target schema "public". Attempted to target schema "${schema}".`,
        );
      }
      break;
    }
    case 'cleanup:go-live': {
      // Go-live cleanup targets public (or test schema in integration tests)
      if (schema !== 'public' && schema !== 'test') {
        throw new Error(
          `[DB GUARD REFUSAL] Go-live cleanup may only target schema "public" (or "test" in test mode). Attempted to target schema "${schema}".`,
        );
      }
      break;
    }
    case 'migrate': {
      // Migrate can target public, test, perf, or temporary verification schemas
      const allowedSchemas = ['public', 'test', 'perf', 'verify_tmp', 'diff_tmp'];
      if (!allowedSchemas.includes(schema)) {
        throw new Error(
          `[DB GUARD REFUSAL] Migrations may only target schemas [${allowedSchemas.join(', ')}]. Attempted to target schema "${schema}".`,
        );
      }
      break;
    }
    case 'deploy': {
      break;
    }
  }
}
