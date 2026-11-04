import { prisma } from '../../../shared/db/index.js';
import { NotFoundError } from '../../../shared/errors/index.js';

export interface CreateHelpArticleInput {
  category: string;
  language?: string;
  title: string;
  bodyMarkdown: string;
  sortOrder?: number;
  published?: boolean;
}

export interface UpdateHelpArticleInput {
  category?: string;
  language?: string;
  title?: string;
  bodyMarkdown?: string;
  sortOrder?: number;
  published?: boolean;
}

export class HelpService {
  /**
   * Retrieves help articles with optional filtering by category or publishing status.
   */
  static async listArticles(params?: {
    category?: string;
    language?: string;
    publishedOnly?: boolean;
  }): Promise<any[]> {
    const where: any = {};
    if (params?.category) where.category = params.category;
    if (params?.language) where.language = params.language;
    if (params?.publishedOnly) where.published = true;

    const articles = await prisma.helpArticle.findMany({
      where,
      orderBy: [{ category: 'asc' }, { sortOrder: 'asc' }],
      include: {
        updatedBy: { select: { email: true, role: true } },
      },
    });

    return articles.map((a) => ({
      id: a.id,
      category: a.category,
      language: a.language,
      title: a.title,
      bodyMarkdown: a.bodyMarkdown,
      sortOrder: a.sortOrder,
      published: a.published,
      updatedBy: a.updatedBy.email || 'Admin',
      updatedAt: a.updatedAt.toISOString(),
      createdAt: a.createdAt.toISOString(),
    }));
  }

  static async getArticle(id: string): Promise<any> {
    const article = await prisma.helpArticle.findUnique({
      where: { id },
    });
    if (!article) {
      throw new NotFoundError('Help article not found');
    }
    return article;
  }

  static async createArticle(userId: string, input: CreateHelpArticleInput): Promise<any> {
    const article = await prisma.helpArticle.create({
      data: {
        category: input.category,
        language: input.language || 'en',
        title: input.title,
        bodyMarkdown: input.bodyMarkdown,
        sortOrder: input.sortOrder || 0,
        published: input.published !== undefined ? input.published : true,
        updatedById: userId,
      },
    });
    return article;
  }

  static async updateArticle(
    userId: string,
    id: string,
    input: UpdateHelpArticleInput,
  ): Promise<any> {
    const existing = await prisma.helpArticle.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundError('Help article not found');
    }

    const updated = await prisma.helpArticle.update({
      where: { id },
      data: {
        category: input.category ?? existing.category,
        language: input.language ?? existing.language,
        title: input.title ?? existing.title,
        bodyMarkdown: input.bodyMarkdown ?? existing.bodyMarkdown,
        sortOrder: input.sortOrder ?? existing.sortOrder,
        published: input.published !== undefined ? input.published : existing.published,
        updatedById: userId,
      },
    });
    return updated;
  }

  static async deleteArticle(id: string): Promise<void> {
    const existing = await prisma.helpArticle.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundError('Help article not found');
    }
    await prisma.helpArticle.delete({ where: { id } });
  }
}
