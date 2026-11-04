import {
  type LegalDocumentType,
  LEGAL_DOCUMENT_STATUS,
  type LegalDocumentStatus,
  CONSENT_TYPES,
  ACTOR_TYPES,
} from '@ap/shared-constants';
import { prisma } from '../../../shared/db/index.js';
import { NotFoundError, ValidationError } from '../../../shared/errors/index.js';
import { AuditService } from '../../audit/audit.service.js';

export interface CreateLegalDocumentInput {
  type: LegalDocumentType;
  language?: string;
  title: string;
  bodyMarkdown: string;
}

export class LegalService {
  /**
   * Retrieves all legal document versions, optionally filtered by type.
   */
  static async listDocuments(type?: LegalDocumentType): Promise<any[]> {
    const docs = await prisma.legalDocument.findMany({
      where: type ? { type } : {},
      include: {
        createdBy: { select: { email: true, role: true } },
      },
      orderBy: [{ type: 'asc' }, { version: 'desc' }],
    });

    return docs.map((d) => ({
      id: d.id,
      type: d.type,
      language: d.language,
      version: d.version,
      title: d.title,
      status: d.status,
      publishedAt: d.publishedAt ? d.publishedAt.toISOString() : null,
      createdBy: d.createdBy.email || 'Admin',
      createdAt: d.createdAt.toISOString(),
      updatedAt: d.updatedAt.toISOString(),
    }));
  }

  /**
   * Retrieves the currently active/published document for a given type and language.
   */
  static async getActiveDocument(type: LegalDocumentType, language = 'en'): Promise<any> {
    const doc = await prisma.legalDocument.findFirst({
      where: {
        type,
        language,
        status: LEGAL_DOCUMENT_STATUS.PUBLISHED,
      },
      orderBy: { version: 'desc' },
    });

    if (!doc) {
      // Fallback to English if localized document is not published
      if (language !== 'en') {
        return this.getActiveDocument(type, 'en');
      }
      throw new NotFoundError(`No published ${type} document found`);
    }

    return {
      id: doc.id,
      type: doc.type,
      language: doc.language,
      version: doc.version,
      title: doc.title,
      bodyMarkdown: doc.bodyMarkdown,
      publishedAt: doc.publishedAt ? doc.publishedAt.toISOString() : null,
    };
  }

  /**
   * Creates a new draft version for a legal document.
   */
  static async createDraft(
    createdById: string,
    input: CreateLegalDocumentInput,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<any> {
    const language = input.language || 'en';

    // Find highest version
    const latest = await prisma.legalDocument.findFirst({
      where: { type: input.type, language },
      orderBy: { version: 'desc' },
    });

    const nextVersion = (latest?.version || 0) + 1;

    const doc = await prisma.legalDocument.create({
      data: {
        type: input.type,
        language,
        version: nextVersion,
        title: input.title,
        bodyMarkdown: input.bodyMarkdown,
        status: LEGAL_DOCUMENT_STATUS.DRAFT,
        createdById,
      },
    });

    await AuditService.log({
      actorId: createdById,
      actorType: ACTOR_TYPES.USER,
      action: 'LEGAL_DOCUMENT_CREATED',
      entityType: 'legal_document',
      entityId: doc.id,
      newValues: { type: doc.type, version: doc.version },
      ipAddress,
      userAgent,
    });

    return doc;
  }

  /**
   * Publishes a draft legal document version, archiving earlier published versions.
   */
  static async publishDocument(
    publishedById: string,
    id: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<any> {
    const doc = await prisma.legalDocument.findUnique({ where: { id } });
    if (!doc) {
      throw new NotFoundError('Legal document not found');
    }

    if (doc.status === LEGAL_DOCUMENT_STATUS.PUBLISHED) {
      throw new ValidationError('Document is already published');
    }

    const updated = await prisma.legalDocument.update({
      where: { id },
      data: {
        status: LEGAL_DOCUMENT_STATUS.PUBLISHED,
        publishedAt: new Date(),
      },
    });

    await AuditService.log({
      actorId: publishedById,
      actorType: ACTOR_TYPES.USER,
      action: 'LEGAL_DOCUMENT_PUBLISHED',
      entityType: 'legal_document',
      entityId: id,
      newValues: { type: doc.type, version: doc.version },
      ipAddress,
      userAgent,
    });

    return updated;
  }

  /**
   * Computes which published legal documents still require consent from a given user.
   */
  static async getUserPendingConsents(userId: string): Promise<any[]> {
    const publishedDocs = await prisma.legalDocument.findMany({
      where: { status: LEGAL_DOCUMENT_STATUS.PUBLISHED },
    });

    const userConsents = await prisma.consentRecord.findMany({
      where: { userId },
    });

    const pending: any[] = [];
    for (const doc of publishedDocs) {
      const consentType = doc.type as any;
      const matchingConsent = userConsents.find(
        (c: { type: string; version: string }) => c.type === consentType && c.version === doc.version.toString(),
      );

      if (!matchingConsent) {
        pending.push({
          type: doc.type,
          version: doc.version,
          title: doc.title,
          publishedAt: doc.publishedAt ? doc.publishedAt.toISOString() : null,
        });
      }
    }

    return pending;
  }
}
