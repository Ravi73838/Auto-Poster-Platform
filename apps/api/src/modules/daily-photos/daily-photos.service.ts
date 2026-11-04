import { prisma } from '../../shared/db/index.js';
import {
  DAY_STATUS,
  SETTING_KEYS,
  ERROR_CODES,
  ACTOR_TYPES,
  DAILY_PHOTO_STATUS,
  PHOTO_REVIEW_SOURCES,
  type DailyPhotoStatus,
  type PhotoReviewSource,
} from '@ap/shared-constants';
import { AppError } from '../../shared/errors/index.js';
import { TimeService, toISTDate, todayIST } from '../../shared/time/index.js';
import { SettingsService } from '../settings/settings.service.js';
import { AuditService } from '../audit/audit.service.js';
import { eventBus } from '../../events/index.js';
import { storageProvider } from '../../integrations/storage/index.js';
import {
  DailyPhotoChecksRunner,
} from '../photos/checks/daily-checks.js';
import { AssignmentDaysService } from '../assignment-days/assignment-days.service.js';
import { getDayCutoffUtc } from '../assignment-days/assignment-days.math.js';
import type {
  SubmitDailyPhotoInput,
} from '@ap/shared-validation';
import type {
  DailyPhotoSubmissionDto,
  TodayStatusDto,
} from '@ap/shared-types';

export class DailyPhotosService {
  /**
   * Injectable random function for deterministic testing of sampling logic.
   */
  static randomFn: () => number = Math.random;

  /**
   * Submits a daily photo proof for a RUNNING assignment.
   */
  static async submitDailyPhoto(
    driverUserId: string,
    assignmentId: string,
    input: SubmitDailyPhotoInput,
  ): Promise<DailyPhotoSubmissionDto> {
    const assignment = await prisma.assignment.findUnique({
      where: { id: assignmentId },
      include: {
        campaign: true,
        vehicle: true,
      },
    });

    if (!assignment) {
      throw new AppError(ERROR_CODES.ASSIGNMENT_NOT_FOUND, 404, 'Assignment not found');
    }

    if (assignment.driverId !== driverUserId) {
      throw new AppError(ERROR_CODES.FORBIDDEN, 403, 'You do not own this assignment');
    }

    if (assignment.status !== 'RUNNING') {
      throw new AppError(
        ERROR_CODES.DAILY_PHOTO_NOT_ALLOWED,
        400,
        `Cannot submit daily photo when assignment status is ${assignment.status}. Must be RUNNING.`,
      );
    }

    const capturedDate = new Date(input.capturedAt);
    const photoDateStr = toISTDate(capturedDate);

    // Ensure day row exists for today
    await AssignmentDaysService.ensureDayRows(assignmentId, photoDateStr);

    const dayUtc = new Date(`${photoDateStr}T00:00:00.000Z`);
    const dayRow = await prisma.assignmentDay.findUnique({
      where: {
        assignmentId_date: {
          assignmentId,
          date: dayUtc,
        },
      },
    });

    if (dayRow && dayRow.status === DAY_STATUS.VERIFIED) {
      throw new AppError(
        ERROR_CODES.DAY_ALREADY_VERIFIED,
        400,
        `Date ${photoDateStr} already has a verified photo proof.`,
      );
    }

    // Check daily attempts cap
    const maxAttempts = await SettingsService.get(SETTING_KEYS.MAX_DAILY_ATTEMPTS).catch(() => 5);
    const todayAttemptsCount = await prisma.photo.count({
      where: {
        assignmentId,
        kind: 'DAILY',
        photoDate: dayUtc,
      },
    });

    if (todayAttemptsCount >= maxAttempts) {
      throw new AppError(
        ERROR_CODES.DAILY_ATTEMPTS_EXCEEDED,
        400,
        `Maximum daily photo attempts (${maxAttempts}) exceeded for date ${photoDateStr}.`,
      );
    }

    // Verify uploaded file
    const upload = await prisma.uploadedFile.findUnique({
      where: { id: input.uploadedFileId },
    });

    if (!upload) {
      throw new AppError(ERROR_CODES.FILE_NOT_FOUND, 404, 'Uploaded photo file record not found');
    }

    if (upload.ownerUserId !== driverUserId) {
      throw new AppError(ERROR_CODES.FORBIDDEN, 403, 'You do not own the uploaded photo file');
    }

    // Read buffer and compute SHA-256
    const buffer = await storageProvider.getObject(upload.fileKey);
    const fileSha256 = DailyPhotoChecksRunner.computeFileSha256(buffer);

    // Run photo verification pipeline
    const checkSummary = await DailyPhotoChecksRunner.runChecks({
      imageBuffer: buffer,
      mimeType: upload.mimeType,
      sizeBytes: upload.sizeBytes,
      fileSha256,
      latitude: input.latitude,
      longitude: input.longitude,
      accuracyMeters: input.accuracyMeters,
      capturedAt: capturedDate,
      clientSentAt: input.clientSentAt ? new Date(input.clientSentAt) : undefined,
      isMockLocation: input.isMockLocation,
      deviceInfo: input.deviceInfo,
      assignmentId,
      campaignId: assignment.campaignId,
      driverId: driverUserId,
      vehicleId: assignment.vehicleId,
    });

    // Handle HARD failures:
    // HARD failures never consume an attempt and do not create a Photo record
    if (checkSummary.hardFailures.length > 0) {
      const primaryFail = checkSummary.hardFailures[0]!;
      throw new AppError(
        primaryFail.errorCode as any,
        400,
        primaryFail.message,
      );
    }

    const now = TimeService.now();
    const attemptNo = todayAttemptsCount + 1;

    // Determine photo status & routing
    let photoStatus: DailyPhotoStatus;
    let reviewSource: PhotoReviewSource | null = null;
    let newDayStatus: typeof DAY_STATUS[keyof typeof DAY_STATUS];

    if (!checkSummary.autoVerifyEligible) {
      // Route to manual review
      photoStatus = DAILY_PHOTO_STATUS.MANUAL_REVIEW;
      reviewSource = PHOTO_REVIEW_SOURCES.AUTO_FLAGGED;
      newDayStatus = DAY_STATUS.UNDER_REVIEW;
    } else {
      // Auto-verified
      photoStatus = DAILY_PHOTO_STATUS.VERIFIED;
      newDayStatus = DAY_STATUS.VERIFIED;

      // Check random sampling (10% default, multiplied by 3 if driver had >= 2 rejections in last 30d)
      const baseSampleRate = await SettingsService.get(SETTING_KEYS.RANDOM_REVIEW_PERCENT).catch(() => 10);
      const samplingMultiplier = await SettingsService.get(SETTING_KEYS.SAMPLING_MULTIPLIER_AFTER_REJECT).catch(() => 3);

      const recent30dRejections = await prisma.photo.count({
        where: {
          driverId: driverUserId,
          status: 'REJECTED',
          createdAt: { gte: new Date(now.getTime() - 30 * 86400000) },
        },
      });

      const effectiveRate = recent30dRejections >= 2 ? baseSampleRate * samplingMultiplier : baseSampleRate;
      const roll = this.randomFn() * 100;

      if (roll < effectiveRate) {
        reviewSource = PHOTO_REVIEW_SOURCES.RANDOM_SAMPLE;
      }
    }

    // Save Photo in transaction with AssignmentDay update
    const { photo } = await prisma.$transaction(async (tx) => {
      // Guard against race conditions for already verified day
      const currentDay = await tx.assignmentDay.findUnique({
        where: {
          assignmentId_date: {
            assignmentId,
            date: dayUtc,
          },
        },
      });

      if (currentDay && currentDay.status === DAY_STATUS.VERIFIED) {
        throw new AppError(
          ERROR_CODES.DAY_ALREADY_VERIFIED,
          400,
          `Date ${photoDateStr} was just verified by another concurrent submission.`,
        );
      }

      const createdPhoto = await tx.photo.create({
        data: {
          assignmentId,
          driverId: driverUserId,
          kind: 'DAILY',
          photoDate: dayUtc,
          photoUrl: upload.fileKey,
          thumbnailUrl: upload.thumbnailKey,
          lat: input.latitude,
          lng: input.longitude,
          accuracyMeters: input.accuracyMeters,
          capturedAt: capturedDate,
          uploadedAt: now,
          status: photoStatus,
          dhash: checkSummary.dhash,
          riskScore: checkSummary.riskScore,
          reviewSource,
          fileSha256,
          clientSentAt: input.clientSentAt ? new Date(input.clientSentAt) : null,
          attemptNo,
          autoCheckFlags: checkSummary.softFlags as any,
          duplicateFlags: checkSummary.duplicateMatch as any,
        },
      });

      await tx.assignmentDay.upsert({
        where: {
          assignmentId_date: {
            assignmentId,
            date: dayUtc,
          },
        },
        create: {
          assignmentId,
          date: dayUtc,
          status: newDayStatus,
          verifiedPhotoId: photoStatus === DAILY_PHOTO_STATUS.VERIFIED ? createdPhoto.id : null,
          statusChangedAt: now,
        },
        update: {
          status: newDayStatus,
          verifiedPhotoId: photoStatus === DAILY_PHOTO_STATUS.VERIFIED ? createdPhoto.id : null,
          statusChangedAt: now,
        },
      });

      return { photo: createdPhoto };
    });

    await AssignmentDaysService.recomputeCounters(assignmentId);

    // Audit log
    await AuditService.log({
      actorId: driverUserId,
      actorType: ACTOR_TYPES.USER,
      action: 'daily_photo.submitted',
      entityType: 'Photo',
      entityId: photo.id,
      newValues: {
        photoDate: photoDateStr,
        status: photoStatus,
        dayStatus: newDayStatus,
        riskScore: checkSummary.riskScore,
        reviewSource,
        attemptNo,
      },
    });

    // Emit event
    if (photoStatus === DAILY_PHOTO_STATUS.VERIFIED) {
      eventBus.emit('photo.verified', {
        photoId: photo.id,
        assignmentId,
        driverId: driverUserId,
        date: photoDateStr,
        autoVerified: true,
      });
    }

    const attemptsLeftToday = Math.max(0, maxAttempts - attemptNo);

    return {
      photoId: photo.id,
      status: photoStatus,
      dayStatus: newDayStatus,
      attemptsLeftToday,
      autoCheckResult: {
        passed: photoStatus === DAILY_PHOTO_STATUS.VERIFIED,
        riskScore: checkSummary.riskScore,
        messageKey:
          photoStatus === DAILY_PHOTO_STATUS.VERIFIED
            ? 'daily_photo.verified'
            : 'daily_photo.under_review',
      },
      reviewSource,
    };
  }

  /**
   * Retrieves today's assignment status, cutoff time, and attempt counts.
   */
  static async getTodayStatus(driverUserId: string, assignmentId: string): Promise<TodayStatusDto> {
    const assignment = await prisma.assignment.findUnique({
      where: { id: assignmentId },
      include: { campaign: true },
    });

    if (!assignment) {
      throw new AppError(ERROR_CODES.ASSIGNMENT_NOT_FOUND, 404, 'Assignment not found');
    }

    if (assignment.driverId !== driverUserId) {
      throw new AppError(ERROR_CODES.FORBIDDEN, 403, 'You do not own this assignment');
    }

    const todayStr = todayIST();
    const todayUtc = new Date(`${todayStr}T00:00:00.000Z`);

    await AssignmentDaysService.ensureDayRows(assignmentId, todayStr);

    const dayRow = await prisma.assignmentDay.findUnique({
      where: {
        assignmentId_date: {
          assignmentId,
          date: todayUtc,
        },
      },
    });

    const lateGraceHours = await SettingsService.get(SETTING_KEYS.DAILY_PHOTO_LATE_GRACE_HOURS).catch(() => 12);
    const cutoffDate = getDayCutoffUtc(todayStr, lateGraceHours);
    const isPastCutoff = TimeService.now().getTime() > cutoffDate.getTime();

    const maxAttempts = await SettingsService.get(SETTING_KEYS.MAX_DAILY_ATTEMPTS).catch(() => 5);
    const todayAttemptsCount = await prisma.photo.count({
      where: {
        assignmentId,
        kind: 'DAILY',
        photoDate: todayUtc,
      },
    });

    const attemptsLeft = Math.max(0, maxAttempts - todayAttemptsCount);

    const latestPhoto = await prisma.photo.findFirst({
      where: {
        assignmentId,
        kind: 'DAILY',
        photoDate: todayUtc,
      },
      orderBy: { createdAt: 'desc' },
    });

    return {
      dayStatus: (dayRow?.status as any) ?? DAY_STATUS.PENDING,
      cutoffTime: cutoffDate.toISOString(),
      attemptsLeft,
      lastPhotoStatus: latestPhoto?.status,
      rejectReasons: (latestPhoto?.reviewReasonCodes as any) ?? undefined,
      isPastCutoff,
    };
  }

  /**
   * Returns list of driver's daily photos with signed URLs.
   */
  static async listDriverDailyPhotos(
    driverUserId: string,
    assignmentId: string,
    page: number = 1,
    limit: number = 20,
  ): Promise<{ items: any[]; total: number }> {
    const assignment = await prisma.assignment.findUnique({
      where: { id: assignmentId },
    });

    if (!assignment) {
      throw new AppError(ERROR_CODES.ASSIGNMENT_NOT_FOUND, 404, 'Assignment not found');
    }

    if (assignment.driverId !== driverUserId) {
      throw new AppError(ERROR_CODES.FORBIDDEN, 403, 'You do not own this assignment');
    }

    const skip = (page - 1) * limit;
    const [photos, total] = await Promise.all([
      prisma.photo.findMany({
        where: { assignmentId, kind: 'DAILY' },
        orderBy: { photoDate: 'desc' },
        skip,
        take: limit,
      }),
      prisma.photo.count({
        where: { assignmentId, kind: 'DAILY' },
      }),
    ]);

    const items = await Promise.all(
      photos.map(async (p) => {
        let photoSignedUrl = p.photoUrl;
        try {
          photoSignedUrl = await storageProvider.getSignedReadUrl(p.photoUrl, 3600);
        } catch {}

        return {
          id: p.id,
          date: p.photoDate ? toISTDate(p.photoDate) : null,
          photoUrl: photoSignedUrl,
          thumbnailUrl: p.thumbnailUrl ?? photoSignedUrl,
          status: p.status,
          riskScore: p.riskScore,
          reviewSource: p.reviewSource,
          attemptNo: p.attemptNo,
          capturedAt: p.capturedAt.toISOString(),
          rejectReasons: p.reviewReasonCodes,
        };
      }),
    );

    return { items, total };
  }
}

