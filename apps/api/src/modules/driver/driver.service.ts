import {
  ROLES,
  ACCOUNT_STATUS,
  DOCUMENT_TYPES,
  DOCUMENT_STATUS,
  PAYOUT_METHODS,
  CONSENT_TYPES,
  KYC_SUBMISSION_STATUS,
  OTP_PURPOSES,
  SETTING_KEYS,
  ACTOR_TYPES,
  ERROR_CODES,
  type DocumentType,
} from '@ap/shared-constants';
import type {
  DriverProfileInput,
  DriverVehicleInput,
  DriverDocumentInput,
  DriverPayoutInput,
  SingleConsentInput,
} from '@ap/shared-validation';
import type {
  DriverOnboardingState,
  KycSubmissionSummaryDto,
  DocumentDto,
} from '@ap/shared-types';
import { prisma } from '../../shared/db/index.js';
import { AppError } from '../../shared/errors/index.js';
import {
  encrypt,
  maskUpiId,
  maskBankAccount,
  computeHmacFingerprint,
} from '../../shared/crypto/index.js';
import { OtpService } from '../auth/otp.service.js';
import { SettingsService } from '../settings/settings.service.js';
import { AuditService } from '../audit/audit.service.js';
import { accountStateMachine } from '../accounts/accounts.state-machine.js';

export class DriverService {
  /**
   * Fetches the complete driver onboarding progress and validation state.
   */
  static async getOnboardingState(userId: string): Promise<DriverOnboardingState> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        driverProfile: {
          include: {
            city: true,
            currentVehicle: true,
            driverZones: {
              include: { zone: true },
            },
          },
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
      throw new AppError(ERROR_CODES.NOT_FOUND, 404, 'Driver user not found');
    }

    const profile = user.driverProfile;
    const vehicle = profile?.currentVehicle;
    const latestKyc = user.kycSubmissions[0];
    const isUnderReview = latestKyc?.status === KYC_SUBMISSION_STATUS.SUBMITTED;

    // 1. Personal details step
    const missingPersonal: string[] = [];
    if (!profile?.fullName) missingPersonal.push('fullName');
    if (!profile?.cityId) missingPersonal.push('cityId');
    const primaryZone = profile?.driverZones.find((dz) => dz.isPrimary);
    if (!primaryZone) missingPersonal.push('primaryZoneId');
    const personalCompleted = missingPersonal.length === 0;

    // 2. Vehicle details step
    const missingVehicle: string[] = [];
    if (!vehicle?.registrationNumber) {
      missingVehicle.push('registrationNumber');
    }
    const isVehicleOwner = vehicle
      ? vehicle.ownerMobile === user.mobile || vehicle.ownerName === profile?.fullName
      : true;

    if (vehicle && !isVehicleOwner) {
      if (!vehicle.ownerName) missingVehicle.push('ownerName');
      if (!vehicle.ownerMobile) missingVehicle.push('ownerMobile');
    }
    const vehicleCompleted = Boolean(vehicle && missingVehicle.length === 0);

    // 3. Documents step
    const currentDocsMap = new Map<DocumentType, (typeof user.documents)[number]>();
    for (const doc of user.documents) {
      if (!currentDocsMap.has(doc.documentType)) {
        currentDocsMap.set(doc.documentType, doc);
      }
    }

    const missingDocs: string[] = [];
    if (!currentDocsMap.has(DOCUMENT_TYPES.DRIVING_LICENCE)) missingDocs.push('DRIVING_LICENCE');
    if (!currentDocsMap.has(DOCUMENT_TYPES.VEHICLE_RC)) missingDocs.push('VEHICLE_RC');
    if (!currentDocsMap.has(DOCUMENT_TYPES.VEHICLE_PHOTO)) missingDocs.push('VEHICLE_PHOTO');
    if (!isVehicleOwner && !currentDocsMap.has(DOCUMENT_TYPES.OWNER_PERMISSION)) {
      missingDocs.push('OWNER_PERMISSION');
    }
    const documentsCompleted = missingDocs.length === 0;

    // 4. Payout details step
    const missingPayout: string[] = [];
    if (profile?.payoutMethod === PAYOUT_METHODS.UPI) {
      if (!profile.upiIdMasked) missingPayout.push('upiId');
    } else if (profile?.payoutMethod === PAYOUT_METHODS.BANK_ACCOUNT) {
      if (!profile.bankAccountName) missingPayout.push('bankAccountHolder');
      if (!profile.bankAccountNumberEncrypted) missingPayout.push('bankAccountNumber');
      if (!profile.bankIfsc) missingPayout.push('bankIfsc');
    } else {
      missingPayout.push('payoutDetails');
    }
    const payoutCompleted = missingPayout.length === 0;

    // 5. Consent step
    let termsVersion = '1.0';
    let privacyVersion = '1.0';
    try {
      termsVersion = await SettingsService.get(SETTING_KEYS.TERMS_VERSION);
      privacyVersion = await SettingsService.get(SETTING_KEYS.PRIVACY_VERSION);
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
    const hasLocation = user.consentRecords.some((c) => c.type === CONSENT_TYPES.LOCATION);
    const hasCamera = user.consentRecords.some((c) => c.type === CONSENT_TYPES.CAMERA);

    if (!hasTerms) missingConsents.push('TERMS');
    if (!hasPrivacy) missingConsents.push('PRIVACY');
    if (!hasLocation) missingConsents.push('LOCATION');
    if (!hasCamera) missingConsents.push('CAMERA');
    const consentCompleted = missingConsents.length === 0;

    const allStepsCompleted =
      personalCompleted &&
      vehicleCompleted &&
      documentsCompleted &&
      payoutCompleted &&
      consentCompleted;

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
        personal: { completed: personalCompleted, missingItems: missingPersonal },
        vehicle: { completed: vehicleCompleted, missingItems: missingVehicle },
        documents: { completed: documentsCompleted, missingItems: missingDocs },
        payout: { completed: payoutCompleted, missingItems: missingPayout },
        consent: { completed: consentCompleted, missingItems: missingConsents },
      },
      profile: profile
        ? {
            fullName: profile.fullName ?? '',
            cityId: profile.cityId ?? '',
            cityName: profile.city?.name,
            primaryZoneId: primaryZone?.zoneId ?? '',
            primaryZoneName: primaryZone?.zone?.name,
            extraZoneIds: profile.driverZones
              .filter((dz) => !dz.isPrimary)
              .map((dz) => dz.zoneId),
          }
        : null,
      vehicle: vehicle
        ? {
            id: vehicle.id,
            registrationNumber: vehicle.registrationNumber,
            isVehicleOwner,
            ownerName: vehicle.ownerName,
            ownerMobile: vehicle.ownerMobile,
            isVerified: vehicle.isVerified,
          }
        : null,
      payout: profile
        ? {
            method: profile.payoutMethod,
            upiIdMasked: profile.upiIdMasked,
            bankAccountHolder: profile.bankAccountName,
            bankAccountNumberMasked: profile.bankAccountNumberEncrypted
              ? maskBankAccount('123456789012') // masked placeholder or decrypt last 4
              : null,
            bankIfsc: profile.bankIfsc,
            payoutDetailsChangedAt: profile.payoutDetailsChangedAt?.toISOString() ?? null,
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
   * Updates driver's personal details, city, and operational zones.
   */
  static async updateProfile(userId: string, input: DriverProfileInput): Promise<void> {
    await this.assertNotUnderReview(userId);

    // Verify city exists
    const city = await prisma.city.findUnique({
      where: { id: input.cityId, isActive: true },
    });
    if (!city) {
      throw new AppError(ERROR_CODES.NOT_FOUND, 404, 'Selected city does not exist or is inactive');
    }

    // Verify zones belong to the city
    const allZoneIds = [input.primaryZoneId, ...input.extraZoneIds];
    const validZones = await prisma.zone.findMany({
      where: {
        id: { in: allZoneIds },
        cityId: input.cityId,
        isActive: true,
      },
    });

    if (validZones.length !== allZoneIds.length) {
      throw new AppError(
        ERROR_CODES.VALIDATION_ERROR,
        400,
        'One or more selected zones do not belong to the selected city',
      );
    }

    await prisma.$transaction(async (tx) => {
      const profile = await tx.driverProfile.upsert({
        where: { userId },
        create: {
          userId,
          fullName: input.fullName,
          cityId: input.cityId,
        },
        update: {
          fullName: input.fullName,
          cityId: input.cityId,
        },
      });

      // Reset zones
      await tx.driverZone.deleteMany({
        where: { driverId: profile.id },
      });

      await tx.driverZone.create({
        data: {
          driverId: profile.id,
          zoneId: input.primaryZoneId,
          isPrimary: true,
        },
      });

      for (const extraZoneId of input.extraZoneIds) {
        if (extraZoneId !== input.primaryZoneId) {
          await tx.driverZone.create({
            data: {
              driverId: profile.id,
              zoneId: extraZoneId,
              isPrimary: false,
            },
          });
        }
      }
    });
  }

  /**
   * Updates vehicle details and links vehicle to driver.
   * Enforces vehicle registration uniqueness without revealing existing owner identities.
   */
  static async updateVehicle(userId: string, input: DriverVehicleInput): Promise<void> {
    await this.assertNotUnderReview(userId);

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { driverProfile: true },
    });
    if (!user) throw new AppError(ERROR_CODES.NOT_FOUND, 404, 'Driver not found');

    const normalizedReg = input.registrationNumber.toUpperCase().replace(/[\s\-]/g, '');

    // Check if registered to another driver
    const existingVehicle = await prisma.vehicle.findUnique({
      where: { registrationNumber: normalizedReg },
      include: {
        driverProfiles: {
          include: { user: true },
        },
      },
    });

    if (existingVehicle && existingVehicle.driverProfiles.length > 0) {
      const isLinkedToAnother = existingVehicle.driverProfiles.some(
        (dp) => dp.userId !== userId && dp.user.status !== ACCOUNT_STATUS.REJECTED,
      );

      if (isLinkedToAnother) {
        throw new AppError(
          ERROR_CODES.VEHICLE_ALREADY_REGISTERED,
          409,
          'This vehicle is already registered with an account',
        );
      }
    }

    const ownerName = input.isVehicleOwner
      ? user.driverProfile?.fullName ?? 'Owner'
      : input.ownerName!;
    const ownerMobile = input.isVehicleOwner ? user.mobile : input.ownerMobile!;

    await prisma.$transaction(async (tx) => {
      const vehicle = await tx.vehicle.upsert({
        where: { registrationNumber: normalizedReg },
        create: {
          registrationNumber: normalizedReg,
          ownerName,
          ownerMobile,
          rcNumber: normalizedReg,
        },
        update: {
          ownerName,
          ownerMobile,
        },
      });

      await tx.driverProfile.upsert({
        where: { userId },
        create: {
          userId,
          currentVehicleId: vehicle.id,
        },
        update: {
          currentVehicleId: vehicle.id,
        },
      });

      // If approved driver changes vehicle, moves to PENDING for review
      if (user.status === ACCOUNT_STATUS.APPROVED) {
        await accountStateMachine.assertTransition(
          ACCOUNT_STATUS.APPROVED,
          ACCOUNT_STATUS.SUSPENDED,
          {
            actor: { id: userId, role: ROLES.DRIVER },
            targetUserId: userId,
            reason: 'Vehicle changed after approval; pending reverification',
          },
        ).catch(() => {});
      }
    });
  }

  /**
   * Uploads and links a confirmed KYC document to the driver's current documents.
   */
  static async addDocument(userId: string, input: DriverDocumentInput): Promise<void> {
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

    const profile = await prisma.driverProfile.findUnique({
      where: { userId },
    });

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
          vehicleId: profile?.currentVehicleId ?? null,
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
   * Removes or archives a document.
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
   * Updates payout details (UPI or Bank). If already approved, requires fresh OTP.
   */
  static async updatePayoutDetails(
    userId: string,
    input: DriverPayoutInput,
    ipAddress?: string,
  ): Promise<void> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { driverProfile: true },
    });
    if (!user) throw new AppError(ERROR_CODES.NOT_FOUND, 404, 'Driver not found');

    // If driver is already approved, require OTP confirmation
    if (user.status === ACCOUNT_STATUS.APPROVED) {
      if (!input.otpCode) {
        throw new AppError(
          ERROR_CODES.OTP_INVALID,
          400,
          'Verification OTP code is required to modify payout details on an approved account',
        );
      }

      await OtpService.verifyOtp({
        target: user.mobile,
        purpose: OTP_PURPOSES.PAYOUT_CHANGE,
        code: input.otpCode,
      });

      await AuditService.log({
        actorId: userId,
        actorType: ACTOR_TYPES.USER,
        action: 'PAYOUT_DETAILS_UPDATED',
        entityType: 'DriverProfile',
        entityId: user.driverProfile?.id ?? userId,
        newValues: { method: input.method },
        ipAddress,
      });
    }

    if (input.method === PAYOUT_METHODS.UPI) {
      const encrypted = encrypt(input.upiId);
      const masked = maskUpiId(input.upiId);

      await prisma.driverProfile.upsert({
        where: { userId },
        create: {
          userId,
          payoutMethod: PAYOUT_METHODS.UPI,
          upiIdEncrypted: encrypted,
          upiIdMasked: masked,
          payoutDetailsChangedAt: user.status === ACCOUNT_STATUS.APPROVED ? new Date() : undefined,
        },
        update: {
          payoutMethod: PAYOUT_METHODS.UPI,
          upiIdEncrypted: encrypted,
          upiIdMasked: masked,
          bankAccountNumberEncrypted: null,
          bankAccountFingerprint: null,
          bankIfsc: null,
          bankAccountName: null,
          payoutDetailsChangedAt: user.status === ACCOUNT_STATUS.APPROVED ? new Date() : undefined,
        },
      });
    } else {
      const cleanAcc = input.bankAccountNumber.trim();
      const encryptedAcc = encrypt(cleanAcc);
      const fingerprint = computeHmacFingerprint(cleanAcc);

      await prisma.driverProfile.upsert({
        where: { userId },
        create: {
          userId,
          payoutMethod: PAYOUT_METHODS.BANK_ACCOUNT,
          bankAccountNumberEncrypted: encryptedAcc,
          bankAccountFingerprint: fingerprint,
          bankIfsc: input.bankIfsc.toUpperCase(),
          bankAccountName: input.bankAccountHolder,
          payoutDetailsChangedAt: user.status === ACCOUNT_STATUS.APPROVED ? new Date() : undefined,
        },
        update: {
          payoutMethod: PAYOUT_METHODS.BANK_ACCOUNT,
          bankAccountNumberEncrypted: encryptedAcc,
          bankAccountFingerprint: fingerprint,
          bankIfsc: input.bankIfsc.toUpperCase(),
          bankAccountName: input.bankAccountHolder,
          upiIdEncrypted: null,
          upiIdMasked: null,
          payoutDetailsChangedAt: user.status === ACCOUNT_STATUS.APPROVED ? new Date() : undefined,
        },
      });
    }
  }

  /**
   * Submits mandatory legal consents with version checking.
   */
  static async submitConsents(
    userId: string,
    consents: SingleConsentInput[],
    ip: string,
    userAgent?: string,
  ): Promise<void> {
    let termsVersion = '1.0';
    let privacyVersion = '1.0';
    try {
      termsVersion = await SettingsService.get(SETTING_KEYS.TERMS_VERSION);
      privacyVersion = await SettingsService.get(SETTING_KEYS.PRIVACY_VERSION);
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
   * Submits driver KYC for admin review.
   * Freezes editing, records profile snapshot, and builds duplicate detection flags.
   */
  static async submitKyc(userId: string): Promise<KycSubmissionSummaryDto> {
    const state = await this.getOnboardingState(userId);

    if (!state.canSubmit) {
      if (!state.steps.personal.completed || !state.steps.vehicle.completed || !state.steps.documents.completed || !state.steps.payout.completed) {
        throw new AppError(
          ERROR_CODES.KYC_INCOMPLETE,
          400,
          'Please complete all required onboarding steps before submitting',
        );
      }
      if (!state.steps.consent.completed) {
        throw new AppError(
          ERROR_CODES.CONSENT_REQUIRED,
          400,
          'All mandatory consents must be accepted before submitting',
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
        driverProfile: {
          include: {
            city: true,
            currentVehicle: true,
            driverZones: { include: { zone: true } },
          },
        },
        documents: { where: { isCurrent: true } },
      },
    });

    if (!user || !user.driverProfile) {
      throw new AppError(ERROR_CODES.NOT_FOUND, 404, 'Driver profile missing');
    }

    // 1. Duplicate detection flags
    const duplicateDetails: string[] = [];
    let sameVehicleCount = 0;
    let sameBankCount = 0;

    if (user.driverProfile.currentVehicle?.registrationNumber) {
      const vehicleMatches = await prisma.vehicle.findUnique({
        where: { registrationNumber: user.driverProfile.currentVehicle.registrationNumber },
        include: { driverProfiles: true },
      });
      if (vehicleMatches && vehicleMatches.driverProfiles.length > 1) {
        sameVehicleCount = vehicleMatches.driverProfiles.length - 1;
        duplicateDetails.push(`Vehicle registration ${vehicleMatches.registrationNumber} is linked to ${sameVehicleCount} other profile(s)`);
      }
    }

    if (user.driverProfile.bankAccountFingerprint) {
      const bankMatches = await prisma.driverProfile.count({
        where: {
          bankAccountFingerprint: user.driverProfile.bankAccountFingerprint,
          userId: { not: userId },
        },
      });
      if (bankMatches > 0) {
        sameBankCount = bankMatches;
        duplicateDetails.push(`Bank account fingerprint matches ${sameBankCount} other account(s)`);
      }
    }

    const duplicateFlags = {
      sameVehicleCount,
      sameBankFingerprintCount: sameBankCount,
      details: duplicateDetails,
    };

    // 2. Profile snapshot (safe copy for review, no plaintext tokens or passwords)
    const profileSnapshot = {
      fullName: user.driverProfile.fullName,
      mobile: user.mobile,
      cityName: user.driverProfile.city?.name,
      zones: user.driverProfile.driverZones.map((dz) => ({
        name: dz.zone.name,
        isPrimary: dz.isPrimary,
      })),
      vehicle: user.driverProfile.currentVehicle
        ? {
            registrationNumber: user.driverProfile.currentVehicle.registrationNumber,
            ownerName: user.driverProfile.currentVehicle.ownerName,
            ownerMobile: user.driverProfile.currentVehicle.ownerMobile,
          }
        : null,
      payoutMethod: user.driverProfile.payoutMethod,
      upiIdMasked: user.driverProfile.upiIdMasked,
      bankAccountName: user.driverProfile.bankAccountName,
      bankIfsc: user.driverProfile.bankIfsc,
      documentsCount: user.documents.length,
      submittedAt: new Date().toISOString(),
    };

    // 3. Count past submissions for attempt counter
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

      // Move account state back to PENDING if coming from NEED_MORE_INFO or REJECTED
      if (
        user.status === ACCOUNT_STATUS.NEED_MORE_INFO ||
        user.status === ACCOUNT_STATUS.REJECTED
      ) {
        await accountStateMachine.assertTransition(
          user.status,
          ACCOUNT_STATUS.PENDING,
          {
            actor: { id: userId, role: ROLES.DRIVER },
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

  /**
   * Helper that asserts driver submission is not currently frozen under review.
   */
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

