/**
 * Database Environment & Schema Guard
 * Protects databases against unintended destructive operations or schema violations.
 */

export type ScriptTarget =
  | 'migrate'
  | 'deploy'
  | 'seed:base'
  | 'seed:demo'
  | 'seed:load'
  | 'test'
  | 'perf'
  | 'drop:perf'
  | 'cleanup:go-live';

export interface GuardOptions {
  targetSchema?: string;
  connectionUrl?: string;
  allowProductionCleanup?: boolean;
}

/**
 * Masks a database host (first 4 chars, '...', domain suffix)
 * e.g., 'db.wqpvvjtfoqgiecsykjrk.supabase.co' -> 'db.w...supabase.co'
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
      `[DB GUARD REFUSAL] DB_ENVIRONMENT is not set. All database scripts require DB_ENVIRONMENT="development" (or "production" for production deploy/go-live).`,
    );
  }

  // 2. Prohibit development/destructive operations on production databases
  if (dbEnv === 'production') {
    if (target === 'deploy') {
      // Production migrations deploy is permitted
      return;
    }
    if (target === 'cleanup:go-live' && options?.allowProductionCleanup) {
      // Go-live cleanup with explicit production flag
      return;
    }
    throw new Error(
      `[DB GUARD REFUSAL] Operation "${target}" is strictly PROHIBITED when DB_ENVIRONMENT="production".`,
    );
  }

  if (dbEnv !== 'development') {
    throw new Error(
      `[DB GUARD REFUSAL] Unrecognized DB_ENVIRONMENT "${dbEnv}". Must be either "development" or "production".`,
    );
  }

  // 3. Prohibit execution if NODE_ENV is production (unless target is deploy)
  if (nodeEnv === 'production' && target !== 'deploy') {
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
