import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';

// Load .env if present
try {
  const cwdEnv = path.resolve(process.cwd(), '.env');
  const apiEnv = path.resolve(process.cwd(), 'api/.env');
  if (fs.existsSync(apiEnv)) {
    process.loadEnvFile(apiEnv);
  } else if (fs.existsSync(cwdEnv)) {
    process.loadEnvFile(cwdEnv);
  }
} catch {
  // ignore
}

// Default DIRECT_URL and DB_ENVIRONMENT if absent from process.env
if (!process.env.DIRECT_URL && process.env.DATABASE_URL) {
  process.env.DIRECT_URL = process.env.DATABASE_URL;
}
if (!process.env.DB_ENVIRONMENT) {
  process.env.DB_ENVIRONMENT = 'development';
}

export function deriveTestDatabaseUrl(mainDbUrl: string, explicitTestUrl?: string): string {
  if (explicitTestUrl && explicitTestUrl.trim().length > 0) {
    return explicitTestUrl;
  }
  try {
    const parsed = new URL(mainDbUrl);
    parsed.searchParams.set('schema', 'test');
    if (!parsed.searchParams.has('connection_limit')) {
      parsed.searchParams.set('connection_limit', '5');
    }
    return parsed.toString();
  } catch {
    const sep = mainDbUrl.includes('?') ? '&' : '?';
    return `${mainDbUrl}${sep}schema=test&connection_limit=5`;
  }
}

export const rawEnvSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    DB_ENVIRONMENT: z.enum(['development', 'production']).default('development'),
    API_PORT: z.coerce.number().default(4000),
    DATABASE_URL: z
      .string()
      .default(
        'postgresql://autoposter:autoposter_local_secret@127.0.0.1:5432/autoposter_dev?schema=public',
      ),
    DIRECT_URL: z.string().optional(),
    DATABASE_URL_TEST: z.string().optional(),
    REDIS_URL: z.string().default('redis://127.0.0.1:6380'),
    CORS_ORIGINS: z.string().default('http://localhost:5173,http://localhost:3000'),
    ENCRYPTION_KEY: z
      .string()
      .min(32, { message: 'ENCRYPTION_KEY must be at least 32 characters long' })
      .default('0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'),
    OTP_HMAC_SECRET: z
      .string()
      .min(32, { message: 'OTP_HMAC_SECRET must be at least 32 characters long' })
      .default('autoposter_dev_hmac_secret_32_characters_long_min'),
    HMAC_SECRET: z.string().optional(),
    JWT_ACCESS_SECRET: z
      .string()
      .min(32, { message: 'JWT_ACCESS_SECRET must be at least 32 characters long' })
      .default('autoposter_jwt_access_secret_min_32_chars_long!'),
    JWT_ACCESS_TTL: z.string().default('15m'),
    REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().positive().default(30),
    SMS_PROVIDER: z.enum(['dev', 'none']).default('dev'),
    OTP_DEV_BYPASS_CODE: z.string().optional(),
    PUSH_PROVIDER: z.enum(['expo', 'dev', 'none']).default('dev'),
    EXPO_ACCESS_TOKEN: z.string().optional(),
    EMAIL_PROVIDER: z.enum(['smtp', 'dev', 'none']).default('smtp'),
    SMTP_HOST: z.string().default('127.0.0.1'),
    SMTP_PORT: z.coerce.number().default(1025),
    SMTP_USER: z.string().optional(),
    SMTP_PASS: z.string().optional(),
    EMAIL_FROM: z.string().default('notifications@autoposter.local'),
    S3_ENDPOINT: z.string().default('http://127.0.0.1:9000'),
    S3_REGION: z.string().default('us-east-1'),
    S3_BUCKET: z.string().default('autoposter-uploads'),
    S3_ACCESS_KEY: z.string().default('minioadmin'),
    S3_SECRET_KEY: z.string().default('minioadmin123'),
    S3_FORCE_PATH_STYLE: z.preprocess((val) => val === 'true' || val === true, z.boolean()).default(true),
    ENABLE_DEV_PAYMENT_SIMULATION: z.preprocess(
      (val) => val === 'true' || val === true,
      z.boolean(),
    ).default(false),
  });

export const envSchema = rawEnvSchema.superRefine((data, ctx) => {
    // Validate DATABASE_URL_TEST when provided
    if (data.DATABASE_URL_TEST && data.DATABASE_URL_TEST.trim().length > 0) {
      try {
        const main = new URL(data.DATABASE_URL);
        const test = new URL(data.DATABASE_URL_TEST);
        if (main.hostname !== test.hostname) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['DATABASE_URL_TEST'],
            message: `DATABASE_URL_TEST host must match DATABASE_URL host (${main.hostname})`,
          });
        }
        const schema = test.searchParams.get('schema');
        if (schema !== 'test') {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['DATABASE_URL_TEST'],
            message: `DATABASE_URL_TEST must target schema=test (received: ${schema || 'none'})`,
          });
        }
      } catch {
        // Skip URL parsing error for mock/non-URL strings
      }
    }

    if (data.NODE_ENV === 'production') {
      if (data.ENABLE_DEV_PAYMENT_SIMULATION) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['ENABLE_DEV_PAYMENT_SIMULATION'],
          message:
            'ENABLE_DEV_PAYMENT_SIMULATION is strictly prohibited in production environment',
        });
      }
      if (data.SMS_PROVIDER === 'dev') {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['SMS_PROVIDER'],
          message: 'SMS_PROVIDER cannot be "dev" in production environment',
        });
      }
      if (data.OTP_DEV_BYPASS_CODE && data.OTP_DEV_BYPASS_CODE.trim().length > 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['OTP_DEV_BYPASS_CODE'],
          message: 'OTP_DEV_BYPASS_CODE is strictly prohibited in production environment',
        });
      }
    }
  });

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const offendingKeys = Array.from(
    new Set(parsed.error.issues.map((i) => i.path.join('.')).filter(Boolean)),
  );
  process.stderr.write(
    `[ENV ERROR] Invalid or missing environment variable(s): ${offendingKeys.join(', ')}\n`,
  );
  process.exit(1);
}

const resolvedHmacSecret =
  process.env.OTP_HMAC_SECRET ||
  process.env.HMAC_SECRET ||
  parsed.data.OTP_HMAC_SECRET;

export const env = {
  ...parsed.data,
  DIRECT_URL: parsed.data.DIRECT_URL || parsed.data.DATABASE_URL,
  DATABASE_URL_TEST: deriveTestDatabaseUrl(parsed.data.DATABASE_URL, parsed.data.DATABASE_URL_TEST),
  OTP_HMAC_SECRET: resolvedHmacSecret,
  HMAC_SECRET: resolvedHmacSecret,
  corsOriginsList: parsed.data.CORS_ORIGINS.split(',').map((origin) => origin.trim()),
  webOriginsList: parsed.data.CORS_ORIGINS.split(',').map((origin) => origin.trim()),
};

