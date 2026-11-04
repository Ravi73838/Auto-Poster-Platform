import {
  ROLES,
  ACCOUNT_STATUS,
  DOCUMENT_TYPES,
  DOCUMENT_STATUS,
  CONSENT_TYPES,
  KYC_SUBMISSION_STATUS,
  SETTING_KEYS,
  ERROR_CODES,
  type DocumentType,
} from '@ap/shared-constants';
import type {
  CompanyProfileInput,
  CompanyDocumentInput,
  SingleConsentInput,
} from '@ap/shared-validation';
import type {
  CompanyOnboardingState,
  KycSubmissionSummaryDto,
  DocumentDto,
} from '@ap/shared-types';
import { prisma } from '../../shared/db/index.js';
import { AppError } from '../../shared/errors/index.js';
import { SettingsService } from '../settings/settings.service.js';
import { accountStateMachine } from '../accounts/accounts.state-machine.js';
import { gstVerifier } from './gst-verifier.js';

export class CompanyService {
  /**
   * Fetches the full company onboarding progress and required document checklist.
   */
  static async getOnboardingState(userId: string): Promise<CompanyOnboardingState> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        companyProfile: {
          include: { city: true },
        },
        documents: {
          where: { isCurrent: true },
          orderBy: { createdAt: 'desc' },
        },
        consentRecords: true,
        kycSubmissions: {
          orderBy: { submittedAt: 'desc' },
          take: 1,
        },
      },
    });

    if (!user) {
      throw new AppError(ERROR_CODES.NOT_FOUND, 404, 'Company user not found');
    }

    const profile = user.companyProfile;
    const latestKyc = user.kycSubmissions[0];
    const isUnderReview = latestKyc?.status === KYC_SUBMISSION_STATUS.SUBMITTED;

    // 1. Business details step
    const missingBusiness: string[] = [];
    if (!profile?.companyName) missingBusiness.push('businessName');
    if (!profile?.cityId) missingBusiness.push('cityId');
    if (!profile?.contactPersonName) missingBusiness.push('contactPersonName');
    if (!profile?.contactPersonPhone) missingBusiness.push('contactMobile');
    if (!profile?.billingAddress) missingBusiness.push('address');
    const businessCompleted = missingBusiness.length === 0;

    // 2. Documents step
    const currentDocsMap = new Map<DocumentType, (typeof user.documents)[number]>();
    for (const doc of user.documents) {
      if (!currentDocsMap.has(doc.documentType)) {
        currentDocsMap.set(doc.documentType, doc);
      }
    }

    const missingDocs: string[] = [];
    if (profile?.gstin) {
      // With GST, GST_CERTIFICATE is mandatory
      if (!currentDocsMap.has(DOCUMENT_TYPES.GST_CERTIFICATE)) {
        missingDocs.push('GST_CERTIFICATE');
      }
    } else {
      // Without GST, BUSINESS_PROOF is mandatory
      if (!currentDocsMap.has(DOCUMENT_TYPES.BUSINESS_PROOF)) {
        missingDocs.push('BUSINESS_PROOF');
      }
    }
    const documentsCompleted = missingDocs.length === 0;

    // 3. Consent step
    let termsVersion = '1.0';
    let privacyVersion = '1.0';
    let posterPolicyVersion = '1.0';
    try {
      termsVersion = await SettingsService.get(SETTING_KEYS.TERMS_VERSION);
      privacyVersion = await SettingsService.get(SETTING_KEYS.PRIVACY_VERSION);
      posterPolicyVersion = await SettingsService.get(SETTING_KEYS.POSTER_POLICY_VERSION);
    } catch {
      // fallback
    }

    const missingConsents: string[] = [];
    const hasTerms = user.consentRecords.some(
      (c) => c.type === CONSENT_TYPES.TERMS && c.version === termsVersion,
    );
    const hasPrivacy = user.consentRecords.some(
      (c) => c.type === CONSENT_TYPES.PRIVACY && c.version === privacyVersion,
    );
    const hasPosterPolicy = user.consentRecords.some(
      (c) => c.type === CONSENT_TYPES.POSTER_POLICY && c.version === posterPolicyVersion,
    );

    if (!hasTerms) missingConsents.push('TERMS');
    if (!hasPrivacy) missingConsents.push('PRIVACY');
    if (!hasPosterPolicy) missingConsents.push('POSTER_POLICY');
    const consentCompleted = missingConsents.length === 0;

    const allStepsCompleted = businessCompleted && documentsCompleted && consentCompleted;
    const canSubmit = allStepsCompleted && !isUnderReview;

    const documentDtos: DocumentDto[] = user.documents.map((d) => ({
      id: d.id,
      documentType: d.documentType,
      status: d.status,
      rejectReasonCode: d.rejectReasonCode,
      rejectionReason: d.rejectionReason,
      uploadedFileId: d.uploadedFileId,
      fileUrl: d.fileUrl,
      mimeType: d.mimeType,
      fileSizeBytes: d.fileSizeBytes,
      isCurrent: d.isCurrent,
      createdAt: d.createdAt.toISOString(),
      verifiedAt: d.verifiedAt?.toISOString() ?? null,
    }));

    const latestKycSummary: KycSubmissionSummaryDto | null = latestKyc
      ? {
          id: latestKyc.id,
          attemptNo: latestKyc.attemptNo,
          status: latestKyc.status,
          submittedAt: latestKyc.submittedAt.toISOString(),
          decisionNote: latestKyc.decisionNote,
          reviewReasons: latestKyc.reviewReasons as KycSubmissionSummaryDto['reviewReasons'],
          assignedToId: latestKyc.assignedToId,
          reviewedById: latestKyc.reviewedById,
          reviewedAt: latestKyc.reviewedAt?.toISOString() ?? null,
        }
      : null;

    return {
      status: user.status,
      canSubmit,
      steps: {
        business: { completed: businessCompleted, missingItems: missingBusiness },
        documents: { completed: documentsCompleted, missingItems: missingDocs },
        consent: { completed: consentCompleted, missingItems: missingConsents },
      },
      profile: profile
        ? {
            businessName: profile.companyName,
            gstNumber: profile.gstin,
            address: (profile.billingAddress as NonNullable<CompanyOnboardingState['profile']>['address']) ?? {
              street: '',
              city: '',
              state: '',
              postalCode: '',
            },
            cityId: profile.cityId ?? '',
            cityName: profile.city?.name,
            contactPersonName: profile.contactPersonName,
            contactEmail: user.email ?? '',
            contactMobile: profile.contactPersonPhone,
            website: profile.website,
            isVerified: profile.isVerified,
          }
        : null,
      documents: documentDtos,
      consents: user.consentRecords.map((c) => ({
        type: c.type,
        version: c.version,
        acceptedAt: c.acceptedAt.toISOString(),
      })),
      latestKyc: latestKycSummary,
    };
  }

  /**
   * Updates company business details and validates GSTIN uniqueness.
   */
  static async updateProfile(userId: string, input: CompanyProfileInput): Promise<void> {
    await this.assertNotUnderReview(userId);

    // Verify city exists and is active
    const city = await prisma.city.findUnique({
      where: { id: input.cityId, isActive: true },
    });
    if (!city) {
      throw new AppError(ERROR_CODES.NOT_FOUND, 404, 'Selected city does not exist or is inactive');
    }

    let normalizedGst: string | null = null;
    if (input.gstNumber && input.gstNumber.trim().length > 0) {
      normalizedGst = input.gstNumber.toUpperCase().trim();

      // Check GSTIN uniqueness across companies
      const existingGst = await prisma.companyProfile.findUnique({
        where: { gstin: normalizedGst },
      });

      if (existingGst && existingGst.userId !== userId) {
        throw new AppError(
          ERROR_CODES.GST_ALREADY_REGISTERED,
          409,
          'This GSTIN is already registered to another company account',
        );
      }

      // Run GST verifier
      const gstResult = await gstVerifier.verify(normalizedGst);
      if (!gstResult.isValid) {
        throw new AppError(
          ERROR_CODES.INVALID_GST_NUMBER,
          400,
          'GSTIN failed validation verification',
        );
      }
    }

    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: {
          email: input.contactEmail,
        },
      });

      await tx.companyProfile.upsert({
        where: { userId },
        create: {
          userId,
          companyName: input.businessName,
          gstin: normalizedGst,
          cityId: input.cityId,
          billingAddress: input.address,
          contactPersonName: input.contactPersonName,
          contactPersonPhone: input.contactMobile,
          website: input.website || null,
        },
        update: {
          companyName: input.businessName,
          gstin: normalizedGst,
          cityId: input.cityId,
          billingAddress: input.address,
          contactPersonName: input.contactPersonName,
          contactPersonPhone: input.contactMobile,
          website: input.website || null,
        },
      });
    });
  }

  /**
   * Adds a confirmed KYC document to the company's profile.
   */
  static async addDocument(userId: string, input: CompanyDocumentInput): Promise<void> {
    await this.assertNotUnderReview(userId);

    const file = await prisma.uploadedFile.findUnique({
      where: { id: input.uploadedFileId },
    });

    if (!file) {
      throw new AppError(ERROR_CODES.FILE_NOT_FOUND, 404, 'Uploaded file not found');
    }

    if (file.ownerUserId !== userId) {
      throw new AppError(ERROR_CODES.FORBIDDEN, 403, 'You do not own this uploaded file');
    }

    if (file.status !== 'CONFIRMED') {
      throw new AppError(
        ERROR_CODES.UPLOAD_NOT_CONFIRMED,
        400,
        'File upload must be confirmed before attaching as a document',
      );
    }

    await prisma.$transaction(async (tx) => {
      // Mark existing current document of this type as not current
      await tx.document.updateMany({
        where: {
          userId,
          documentType: input.type,
          isCurrent: true,
        },
        data: { isCurrent: false },
      });

      // Create new current document
      await tx.document.create({
        data: {
          userId,
          uploadedFileId: file.id,
          documentType: input.type,
          mimeType: file.mimeType,
          fileSizeBytes: file.sizeBytes,
          status: DOCUMENT_STATUS.PENDING,
          isCurrent: true,
        },
      });
    });
  }

  /**
   * Archives a company document.
   */
  static async deleteDocument(userId: string, documentId: string): Promise<void> {
    await this.assertNotUnderReview(userId);

    const doc = await prisma.document.findUnique({
      where: { id: documentId },
    });

    if (!doc || doc.userId !== userId) {
      throw new AppError(ERROR_CODES.NOT_FOUND, 404, 'Document not found');
    }

    await prisma.document.update({
      where: { id: documentId },
      data: { isCurrent: false },
    });
  }

  /**
   * Submits mandatory consents for company (TERMS, PRIVACY, POSTER_POLICY).
   */
  static async submitConsents(
    userId: string,
    consents: SingleConsentInput[],
    ip: string,
    userAgent?: string,
  ): Promise<void> {
    let termsVersion = '1.0';
    let privacyVersion = '1.0';
    let posterPolicyVersion = '1.0';
    try {
      termsVersion = await SettingsService.get(SETTING_KEYS.TERMS_VERSION);
      privacyVersion = await SettingsService.get(SETTING_KEYS.PRIVACY_VERSION);
      posterPolicyVersion = await SettingsService.get(SETTING_KEYS.POSTER_POLICY_VERSION);
    } catch {
      // fallback
    }

    for (const c of consents) {
      if (c.type === CONSENT_TYPES.TERMS && c.version !== termsVersion) {
        throw new AppError(
          ERROR_CODES.CONSENT_REQUIRED,
          400,
          `Terms of Service version mismatch. Current version is ${termsVersion}`,
        );
      }
      if (c.type === CONSENT_TYPES.PRIVACY && c.version !== privacyVersion) {
        throw new AppError(
          ERROR_CODES.CONSENT_REQUIRED,
          400,
          `Privacy Policy version mismatch. Current version is ${privacyVersion}`,
        );
      }
      if (c.type === CONSENT_TYPES.POSTER_POLICY && c.version !== posterPolicyVersion) {
        throw new AppError(
          ERROR_CODES.CONSENT_REQUIRED,
          400,
          `Poster Content Policy version mismatch. Current version is ${posterPolicyVersion}`,
        );
      }

      await prisma.consentRecord.upsert({
        where: {
          userId_type_version: {
            userId,
            type: c.type,
            version: c.version,
          },
        },
        create: {
          userId,
          type: c.type,
          version: c.version,
          ip,
          userAgent,
        },
        update: {
          ip,
          userAgent,
          acceptedAt: new Date(),
        },
      });
    }
  }

  /**
   * Submits company KYC submission for admin review.
   */
  static async submitKyc(userId: string): Promise<KycSubmissionSummaryDto> {
    const state = await this.getOnboardingState(userId);

    if (!state.canSubmit) {
      if (!state.steps.business.completed || !state.steps.documents.completed) {
        throw new AppError(
          ERROR_CODES.KYC_INCOMPLETE,
          400,
          'Please complete all required company details and upload required documents',
        );
      }
      if (!state.steps.consent.completed) {
        throw new AppError(
          ERROR_CODES.CONSENT_REQUIRED,
          400,
          'All mandatory consents (Terms, Privacy, Poster Policy) must be accepted before submitting',
        );
      }
      throw new AppError(
        ERROR_CODES.KYC_UNDER_REVIEW,
        400,
        'Your submission is already under review',
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        companyProfile: { include: { city: true } },
        documents: { where: { isCurrent: true } },
      },
    });

    if (!user || !user.companyProfile) {
      throw new AppError(ERROR_CODES.NOT_FOUND, 404, 'Company profile missing');
    }

    // Duplicate detection flags
    const duplicateDetails: string[] = [];
    let sameGstinCount = 0;

    if (user.companyProfile.gstin) {
      const gstinMatches = await prisma.companyProfile.count({
        where: {
          gstin: user.companyProfile.gstin,
          userId: { not: userId },
        },
      });
      if (gstinMatches > 0) {
        sameGstinCount = gstinMatches;
        duplicateDetails.push(`GSTIN ${user.companyProfile.gstin} is registered to ${sameGstinCount} other company account(s)`);
      }
    }

    const duplicateFlags = {
      sameGstinCount,
      details: duplicateDetails,
    };

    const profileSnapshot = {
      companyName: user.companyProfile.companyName,
      gstin: user.companyProfile.gstin,
      address: user.companyProfile.billingAddress,
      cityName: user.companyProfile.city?.name,
      contactPersonName: user.companyProfile.contactPersonName,
      contactEmail: user.email,
      contactMobile: user.companyProfile.contactPersonPhone,
      website: user.companyProfile.website,
      documentsCount: user.documents.length,
      submittedAt: new Date().toISOString(),
    };

    const pastSubmissionsCount = await prisma.kycSubmission.count({
      where: { userId },
    });
    const attemptNo = pastSubmissionsCount + 1;

    const submission = await prisma.$transaction(async (tx) => {
      const sub = await tx.kycSubmission.create({
        data: {
          userId,
          attemptNo,
          status: KYC_SUBMISSION_STATUS.SUBMITTED,
          profileSnapshot,
          duplicateFlags,
        },
      });

      if (
        user.status === ACCOUNT_STATUS.NEED_MORE_INFO ||
        user.status === ACCOUNT_STATUS.REJECTED
      ) {
        await accountStateMachine.assertTransition(
          user.status,
          ACCOUNT_STATUS.PENDING,
          {
            actor: { id: userId, role: ROLES.COMPANY },
            targetUserId: userId,
            isKycSubmission: true,
          },
        );

        await tx.user.update({
          where: { id: userId },
          data: { status: ACCOUNT_STATUS.PENDING },
        });
      }

      return sub;
    });

    return {
      id: submission.id,
      attemptNo: submission.attemptNo,
      status: submission.status,
      submittedAt: submission.submittedAt.toISOString(),
      decisionNote: submission.decisionNote,
      reviewReasons: submission.reviewReasons as KycSubmissionSummaryDto['reviewReasons'],
      assignedToId: submission.assignedToId,
      reviewedById: submission.reviewedById,
      reviewedAt: submission.reviewedAt?.toISOString() ?? null,
    };
  }

  private static async assertNotUnderReview(userId: string): Promise<void> {
    const latestKyc = await prisma.kycSubmission.findFirst({
      where: { userId },
      orderBy: { submittedAt: 'desc' },
    });

    if (latestKyc?.status === KYC_SUBMISSION_STATUS.SUBMITTED) {
      throw new AppError(
        ERROR_CODES.KYC_UNDER_REVIEW,
        400,
        'Your KYC submission is currently under review and cannot be modified.',
      );
    }
  }
}

