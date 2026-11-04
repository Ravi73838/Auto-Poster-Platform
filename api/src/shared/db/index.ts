import { Prisma } from '@prisma/client';
import { prisma, disconnectPrisma } from '../prisma.js';
import {
  AppError,
  ConflictError,
  NotFoundError,
  ValidationError,
} from '../errors/index.js';
import { ERROR_CODES } from '@ap/shared-constants';

export { prisma, disconnectPrisma };
export type TransactionClient = Prisma.TransactionClient;

export async function withTransaction<T>(
  fn: (tx: Prisma.TransactionClient) => Promise<T>,
  options?: {
    maxWait?: number;
    timeout?: number;
    isolationLevel?: Prisma.TransactionIsolationLevel;
  },
): Promise<T> {
  return prisma.$transaction(async (tx) => {
    return fn(tx);
  }, options);
}

export function mapPrismaError(error: unknown): AppError {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    switch (error.code) {
      case 'P2002': {
        const target = (error.meta?.target as string[])?.join(', ') ?? 'field';
        return new ConflictError(`Unique constraint failed on: ${target}`, error.meta);
      }
      case 'P2025': {
        return new NotFoundError(
          (error.meta?.cause as string) ?? 'Record not found',
          error.meta,
        );
      }
      case 'P2003': {
        const fieldName = (error.meta?.field_name as string) ?? 'foreign key';
        return new ValidationError(`Foreign key constraint failed on: ${fieldName}`, error.meta);
      }
      case 'P2014': {
        return new ConflictError('Relation constraint violation', error.meta);
      }
      default:
        return new AppError(
          ERROR_CODES.INTERNAL_ERROR,
          `Database error: ${error.message}`,
          500,
          { code: error.code, meta: error.meta },
        );
    }
  }

  if (error instanceof AppError) {
    return error;
  }

  return new AppError(
    ERROR_CODES.INTERNAL_ERROR,
    error instanceof Error ? error.message : 'Unknown database error',
    500,
  );
}

export interface PaginationParams {
  page: number;
  pageSize: number;
}

export interface PaginationMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

export function getPaginationMeta(
  total: number,
  params: PaginationParams,
): PaginationMeta {
  const page = Math.max(1, params.page);
  const pageSize = Math.max(1, params.pageSize);
  const totalPages = Math.ceil(total / pageSize);

  return {
    page,
    pageSize,
    total,
    totalPages,
    hasNextPage: page < totalPages,
    hasPrevPage: page > 1,
  };
}

export function paginateQuery(params: PaginationParams): {
  skip: number;
  take: number;
} {
  const page = Math.max(1, params.page);
  const pageSize = Math.max(1, params.pageSize);
  return {
    skip: (page - 1) * pageSize,
    take: pageSize,
  };
}

export function notDeletedClause(): { deletedAt: null } {
  return { deletedAt: null };
}
