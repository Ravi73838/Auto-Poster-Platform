import { prisma } from '../../../shared/db/index.js';
import { NotFoundError, ForbiddenError } from '../../../shared/errors/index.js';

export interface CreateSavedViewInput {
  pageKey: string;
  name: string;
  filters: Record<string, unknown>;
  isDefault?: boolean;
}

export interface UpdateSavedViewInput {
  name?: string;
  filters?: Record<string, unknown>;
  isDefault?: boolean;
}

export class SavedViewsService {
  static async listSavedViews(userId: string, pageKey: string): Promise<any[]> {
    const views = await prisma.savedView.findMany({
      where: { userId, pageKey },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
    });

    return views.map((v) => ({
      id: v.id,
      pageKey: v.pageKey,
      name: v.name,
      filters: v.filters,
      isDefault: v.isDefault,
      createdAt: v.createdAt.toISOString(),
      updatedAt: v.updatedAt.toISOString(),
    }));
  }

  static async createSavedView(userId: string, input: CreateSavedViewInput): Promise<any> {
    if (input.isDefault) {
      await prisma.savedView.updateMany({
        where: { userId, pageKey: input.pageKey },
        data: { isDefault: false },
      });
    }

    const view = await prisma.savedView.create({
      data: {
        userId,
        pageKey: input.pageKey,
        name: input.name,
        filters: (input.filters as object) ?? {},
        isDefault: input.isDefault ?? false,
      },
    });

    return {
      id: view.id,
      pageKey: view.pageKey,
      name: view.name,
      filters: view.filters,
      isDefault: view.isDefault,
      createdAt: view.createdAt.toISOString(),
      updatedAt: view.updatedAt.toISOString(),
    };
  }

  static async updateSavedView(
    userId: string,
    id: string,
    input: UpdateSavedViewInput,
  ): Promise<any> {
    const existing = await prisma.savedView.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundError('Saved view not found');
    }
    if (existing.userId !== userId) {
      throw new ForbiddenError('You can only modify your own saved views');
    }

    if (input.isDefault) {
      await prisma.savedView.updateMany({
        where: { userId, pageKey: existing.pageKey },
        data: { isDefault: false },
      });
    }

    const updated = await prisma.savedView.update({
      where: { id },
      data: {
        name: input.name ?? existing.name,
        filters: (input.filters as object) ?? existing.filters,
        isDefault: input.isDefault !== undefined ? input.isDefault : existing.isDefault,
      },
    });

    return {
      id: updated.id,
      pageKey: updated.pageKey,
      name: updated.name,
      filters: updated.filters,
      isDefault: updated.isDefault,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    };
  }

  static async deleteSavedView(userId: string, id: string): Promise<void> {
    const existing = await prisma.savedView.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundError('Saved view not found');
    }
    if (existing.userId !== userId) {
      throw new ForbiddenError('You can only delete your own saved views');
    }

    await prisma.savedView.delete({ where: { id } });
  }
}
