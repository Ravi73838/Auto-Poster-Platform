import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  API_PORT: z.coerce.number().default(4000),
  DATABASE_URL: z.string().default('postgresql://autoposter:autoposter_local_secret@localhost:5432/autoposter_dev?schema=public'),
  REDIS_URL: z.string().default('redis://localhost:6379'),
  CORS_ORIGINS: z.string().default('http://localhost:5173,http://localhost:3000'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  // We use process.stderr here before logger is initialized
  process.stderr.write(`Invalid environment variables: ${JSON.stringify(parsed.error.format())}\n`);
  process.exit(1);
}

export const env = {
  ...parsed.data,
  corsOriginsList: parsed.data.CORS_ORIGINS.split(',').map((origin) => origin.trim()),
};
