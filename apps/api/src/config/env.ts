import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';

// Load .env if present
try {
  const cwdEnv = path.resolve(process.cwd(), '.env');
  const apiEnv = path.resolve(process.cwd(), 'apps/api/.env');
  if (fs.existsSync(apiEnv)) {
    process.loadEnvFile(apiEnv);
  } else if (fs.existsSync(cwdEnv)) {
    process.loadEnvFile(cwdEnv);
  }
} catch {
  // ignore
}

const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    API_PORT: z.coerce.number().default(4000),
    DATABASE_URL: z
      .string()
      .default(
        'postgresql://autoposter:autoposter_local_secret@127.0.0.1:5432/autoposter_dev?schema=public',
      ),
    DATABASE_URL_TEST: z
      .string()
      .default(
        'postgresql://autoposter:autoposter_local_secret@127.0.0.1:5432/autoposter_test?schema=public',
      ),
    REDIS_URL: z.string().default('redis://127.0.0.1:6379'),
    CORS_ORIGINS: z.string().default('http://localhost:5173,http://localhost:3000'),
    WEB_ORIGINS: z.string().default('http://localhost:5173,http://localhost:3000'),
    ENCRYPTION_KEY: z
      .string()
      .min(32, { message: 'ENCRYPTION_KEY must be at least 32 characters long' })
      .default('0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'),
    HMAC_SECRET: z
      .string()
      .min(32, { message: 'HMAC_SECRET must be at least 32 characters long' })
      .default('autoposter_dev_hmac_secret_32_characters_long_min'),
    JWT_ACCESS_SECRET: z
      .string()
      .min(32, { message: 'JWT_ACCESS_SECRET must be at least 32 characters long' })
      .default('autoposter_jwt_access_secret_min_32_chars_long!'),
    JWT_ACCESS_TTL: z.string().default('15m'),
    REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().positive().default(30),
    OTP_HMAC_SECRET: z
      .string()
      .min(32, { message: 'OTP_HMAC_SECRET must be at least 32 characters long' })
      .default('autoposter_otp_hmac_secret_min_32_chars_dev!'),
    SMS_PROVIDER: z.enum(['dev', 'none']).default('dev'),
    OTP_DEV_BYPASS_CODE: z.string().optional(),
    COOKIE_DOMAIN: z.string().optional(),
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
    PUSH_PROVIDER: z.enum(['expo', 'dev', 'none']).default('dev'),
    EXPO_ACCESS_TOKEN: z.string().optional(),
    EMAIL_PROVIDER: z.enum(['smtp', 'dev', 'none']).default('dev'),
    SMTP_HOST: z.string().default('127.0.0.1'),
    SMTP_PORT: z.coerce.number().default(1025),
    SMTP_USER: z.string().optional(),
    SMTP_PASS: z.string().optional(),
    EMAIL_FROM: z.string().default('notifications@autoposter.local'),
  })
  .superRefine((data, ctx) => {
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
  process.stderr.write(`Invalid environment variables: ${JSON.stringify(parsed.error.format())}\n`);
  process.exit(1);
}

export const env = {
  ...parsed.data,
  corsOriginsList: parsed.data.CORS_ORIGINS.split(',').map((origin) => origin.trim()),
  webOriginsList: parsed.data.WEB_ORIGINS.split(',').map((origin) => origin.trim()),
};

