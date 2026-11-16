import { beforeAll } from 'vitest';
import { ensureRedisServer } from './shared/redis/index.js';

beforeAll(async () => {
  await ensureRedisServer();
});

