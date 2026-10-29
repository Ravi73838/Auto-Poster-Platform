import { z } from 'zod';
import { SUPPORTED_LANGUAGES, SUPPORTED_THEMES } from '@ap/shared-constants';

export const indianMobilePhoneSchema = z
  .string()
  .trim()
  .regex(/^[6-9]\d{9}$/, {
    message: 'Invalid Indian mobile number. Must be a 10-digit number starting with 6-9.',
  });

export const uuidSchema = z.string().uuid({
  message: 'Invalid UUID identifier.',
});

export const idParamSchema = z.object({
  id: uuidSchema,
});

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(10),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export type PaginationQuery = z.infer<typeof paginationQuerySchema>;

export const languageSchema = z.enum(
  SUPPORTED_LANGUAGES as unknown as [string, ...string[]],
);

export const themeSchema = z.enum(
  SUPPORTED_THEMES as unknown as [string, ...string[]],
);
