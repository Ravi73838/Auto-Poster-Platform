import { z } from 'zod';

export const healthQuerySchema = z.object({
  deep: z.enum(['true', 'false']).optional(),
});

export type HealthQuery = z.infer<typeof healthQuerySchema>;
