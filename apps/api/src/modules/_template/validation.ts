import { z } from 'zod';

export const createExampleSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
});
