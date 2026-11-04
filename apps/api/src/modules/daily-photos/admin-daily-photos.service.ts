import { prisma } from '../../shared/db/index.js';
import {
  DAY_STATUS,
  SETTING_KEYS,
  ERROR_CODES,
  ACTOR_TYPES,
  DAILY_PHOTO_STATUS,
  PHOTO_FLAG_STATUSES,
  type PhotoReviewSource,
  type PhotoFlagReason,
} from '@ap/shared-constants';
import { AppError } from '../../shared/errors/index.js';
import { TimeService, toISTDate } from '../../shared/time/index.js';
import { SettingsService } from '../settings/settings.service.js';
import { AuditService } from '../audit/audit.service.js';
import { eventBus } from '../../events/index.js';
import { storageProvider } from '../../integrations/storage/index.js';
import { AssignmentDaysService } from '../assignment-days/assignment-days.service.js';
import { isDayCutoffPassed } from '../assignment-days/assignment-days.math.js';
import type {
  ListDailyPhotoQueueQuery,
  ReviewDailyPhotoInput,
} from '@ap/shared-validation';
import type {
  DailyPhotoQueueItemDto,
  DailyPhotoDetailDto,
  FraudOverviewDto,
} from '@ap/shared-types';

export class AdminDailyPhotosService {
  private static readonly CLAIM_LOCK_MINUTES = 10;

  /**
   * Retrieves the daily photo manual review queue.
   */
  static async getQueue(
    adminUserId: string,
    query: ListDailyPhotoQueueQuery,
  ): Promise<{ items: DailyPhotoQueueItemDto[]; nextCursor?: string }> {
    const now = TimeService.now();
    const lockCutoff = new Date(now.getTime() - this.CLAIM_LOCK_MINUTES * 60 * 1000);
    const slaHours = await SettingsService.get(SETTING_KEYS.DAILY_REVIEW_SLA_HOURS).catch(() => 4);

    const where: any = {
      kind: 'DAILY',
      OR: [
        { status: DAILY_PHOTO_STATUS.MANUAL_REVIEW },
        {
          status: DAILY_PHOTO_STATUS.VERIFIED,
          reviewSource: 'RANDOM_SAMPLE',
          reviewedByUserId: null,
        },
      ],
    };

    if (query.source) {
      where.reviewSource = query.source;
    }

    if (query.campaignId) {
      where.assignment = { ...where.assignment, campaignId: query.campaignId };
    }

    if (query.cityId) {
      where.assignment = {
        ...where.assignment,
        campaign: { cityId: query.cityId },
      };
    }

    if (query.minRiskScore !== undefined) {
      where.riskScore = { gte: query.minRiskScore };
    }

    if (query.unassigned) {
      where.AND = [
        ...(where.AND || []),
        {
          OR: [
            { reviewClaimedById: null },
            { reviewClaimedAt: { lt: lockCutoff } },
          ],
        },
      ];
    } else if (query.assignedToMe) {
      where.AND = [
        ...(where.AND || []),
        {
          reviewClaimedById: adminUserId,
          reviewClaimedAt: { gte: lockCutoff },
        },
      ];
    }

    if (query.cursor) {
      where.id = { lt: query.cursor };
    }

    const limit = query.limit || 20;
    const photos = await prisma.photo.findMany({
      where,
      take: limit + 1,
      orderBy: [
        { riskScore: 'desc' },
        { uploadedAt: 'asc' },
      ],
      include: {
        driver: {
          select: {
            id: true,
            mobile: true,
            driverProfile: {
              select: { fullName: true },
            },
          },
        },
        assignment: {
          include: {
            campaign: {
              select: {
                id: true,
                title: true,
                city: { select: { name: true } },
              },
            },
            vehicle: {
              select: {
                registrationNumber: true,
              },
            },
          },
        },
      },
    });

    let nextCursor: string | undefined = undefined;
    if (photos.length > limit) {
      const nextItem = photos.pop()!;
      nextCursor = nextItem.id;
    }

    // Lookup claimer names if needed
    const claimerIds = Array.from(
      new Set(
        photos
          .filter((p) => p.reviewClaimedById && p.reviewClaimedAt && p.reviewClaimedAt >= lockCutoff)
          .map((p) => p.reviewClaimedById!),
      ),
    );

    const claimers = claimerIds.length > 0
      ? await prisma.user.findMany({
          where: { id: { in: claimerIds } },
          select: {
            id: true,
            email: true,
          },
        })
      : [];
    const claimerMap = new Map(claimers.map((c) => [c.id, c.email || 'Admin']));

    const items: DailyPhotoQueueItemDto[] = await Promise.all(
      photos.map(async (p) => {
        let photoSignedUrl = p.photoUrl;
        try {
          photoSignedUrl = await storageProvider.getSignedReadUrl(p.photoUrl, 3600);
        } catch {}

        const waitingMinutes = Math.floor((now.getTime() - p.uploadedAt.getTime()) / 60000);
        const isSlaBreached = waitingMinutes > slaHours * 60;

        const isClaimActive = p.reviewClaimedById && p.reviewClaimedAt && p.reviewClaimedAt >= lockCutoff;
        const claimedById = isClaimActive ? p.reviewClaimedById : null;
        const claimedByName = isClaimActive && p.reviewClaimedById ? claimerMap.get(p.reviewClaimedById) ?? null : null;

        return {
          photoId: p.id,
          assignmentId: p.assignmentId,
          campaignId: p.assignment.campaignId,
          campaignTitle: p.assignment.campaign.title,
          driverId: p.driverId,
          driverName: p.driver.driverProfile?.fullName || null,
          driverMobile: p.driver.mobile,
          vehicleRegistrationNumber: p.assignment.vehicle.registrationNumber,
          cityName: p.assignment.campaign.city?.name || 'General City',
          date: p.photoDate ? toISTDate(p.photoDate) : '',
          capturedAt: p.capturedAt.toISOString(),
          photoUrl: photoSignedUrl,
          thumbnailUrl: p.thumbnailUrl,
          reviewSource: (p.reviewSource as PhotoReviewSource) || 'AUTO_FLAGGED',
          riskScore: p.riskScore,
          autoCheckFlags: p.autoCheckFlags as any,
          isSlaBreached,
          waitingMinutes,
          claimedById,
          claimedByName,
        };
      }),
    );

    return { items, nextCursor };
  }

  /**
   * Claims a photo for review.
   */
  static async claim(adminUserId: string, photoId: string): Promise<void> {
    const photo = await prisma.photo.findUnique({
      where: { id: photoId },
    });

    if (!photo) {
      throw new AppError(ERROR_CODES.NOT_FOUND, 404, 'Photo not found');
    }

    const now = TimeService.now();
    const lockCutoff = new Date(now.getTime() - this.CLAIM_LOCK_MINUTES * 60 * 1000);

    if (
      photo.reviewClaimedById &&
      photo.reviewClaimedById !== adminUserId &&
      photo.reviewClaimedAt &&
      photo.reviewClaimedAt >= lockCutoff
    ) {
      throw new AppError(
        ERROR_CODES.CONFLICT,
        409,
        'This photo is currently claimed by another reviewer.',
      );
    }

    await prisma.photo.update({
      where: { id: photoId },
      data: {
        reviewClaimedById: adminUserId,
        reviewClaimedAt: now,
      },
    });
  }

  /**
   * Releases an active claim on a photo.
   */
  static async release(adminUserId: string, photoId: string): Promise<void> {
    const photo = await prisma.photo.findUnique({
      where: { id: photoId },
    });

    if (!photo) {
      throw new AppError(ERROR_CODES.NOT_FOUND, 404, 'Photo not found');
    }

    if (photo.reviewClaimedById === adminUserId) {
      await prisma.photo.update({
        where: { id: photoId },
        data: {
          reviewClaimedById: null,
          reviewClaimedAt: null,
        },
      });
    }
  }

  /**
   * Claims the next highest priority photo in queue.
   */
  static async claimNext(adminUserId: string): Promise<DailyPhotoDetailDto | null> {
    const now = TimeService.now();
    const lockCutoff = new Date(now.getTime() - this.CLAIM_LOCK_MINUTES * 60 * 1000);

    const nextPhoto = await prisma.photo.findFirst({
      where: {
        kind: 'DAILY',
        OR: [
          { status: DAILY_PHOTO_STATUS.MANUAL_REVIEW },
          {
            status: DAILY_PHOTO_STATUS.VERIFIED,
            reviewSource: 'RANDOM_SAMPLE',
            reviewedByUserId: null,
          },
        ],
        AND: [
          {
            OR: [
              { reviewClaimedById: null },
              { reviewClaimedAt: { lt: lockCutoff } },
              { reviewClaimedById: adminUserId },
            ],
          },
        ],
      },
      orderBy: [
        { riskScore: 'desc' },
        { uploadedAt: 'asc' },
      ],
    });

    if (!nextPhoto) {
      return null;
    }

    await prisma.photo.update({
      where: { id: nextPhoto.id },
      data: {
        reviewClaimedById: adminUserId,
        reviewClaimedAt: now,
      },
    });

    return this.getPhotoDetail(adminUserId, nextPhoto.id);
  }

  /**
   * Gets detail view for reviewing a daily photo.
   */
  static async getPhotoDetail(adminUserId: string, photoId: string): Promise<DailyPhotoDetailDto> {
    const photo = await prisma.photo.findUnique({
      where: { id: photoId },
      include: {
        driver: {
          select: {
            id: true,
            mobile: true,
            driverProfile: { select: { fullName: true } },
          },
        },
        assignment: {
          include: {
            campaign: {
              include: {
                city: { select: { name: true } },
              },
            },
            vehicle: {
              select: {
                registrationNumber: true,
              },
            },
          },
        },
        flags: true,
      },
    });

    if (!photo) {
      throw new AppError(ERROR_CODES.NOT_FOUND, 404, 'Photo not found');
    }

    const now = TimeService.now();
    const slaHours = await SettingsService.get(SETTING_KEYS.DAILY_REVIEW_SLA_HOURS).catch(() => 4);
    const waitingMinutes = Math.floor((now.getTime() - photo.uploadedAt.getTime()) / 60000);
    const isSlaBreached = waitingMinutes > slaHours * 60;

    let photoSignedUrl = photo.photoUrl;
    try {
      photoSignedUrl = await storageProvider.getSignedReadUrl(photo.photoUrl, 3600);
    } catch {}

    // Installation photo comparison
    const installPhoto = await prisma.photo.findFirst({
      where: {
        assignmentId: photo.assignmentId,
        kind: 'INSTALLATION',
        status: DAILY_PHOTO_STATUS.VERIFIED,
      },
      orderBy: { createdAt: 'desc' },
    });

    let installPhotoSignedUrl: string | null = null;
    if (installPhoto) {
      try {
        installPhotoSignedUrl = await storageProvider.getSignedReadUrl(installPhoto.photoUrl, 3600);
      } catch {}
    }

    // Previous day verified photo comparison
    const prevPhoto = await prisma.photo.findFirst({
      where: {
        assignmentId: photo.assignmentId,
        kind: 'DAILY',
        status: 'VERIFIED',
        photoDate: { lt: photo.photoDate ?? new Date() },
      },
      orderBy: { photoDate: 'desc' },
    });

    let prevPhotoSignedUrl: string | null = null;
    if (prevPhoto) {
      try {
        prevPhotoSignedUrl = await storageProvider.getSignedReadUrl(prevPhoto.photoUrl, 3600);
      } catch {}
    }

    // Campaign poster preview
    let posterPreviewUrl: string | null = null;
    if (photo.assignment.campaign.creativeUrl) {
      try {
        posterPreviewUrl = await storageProvider.getSignedReadUrl(
          photo.assignment.campaign.creativeUrl,
          3600,
        );
      } catch {}
    }

    // Driver statistics
    const driverId = photo.driverId;
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 86400000);

    const [totalSubmitted, verifiedCount, rejectedCount, recentRejectionCount30d, missedDaysCount] =
      await Promise.all([
        prisma.photo.count({ where: { driverId, kind: 'DAILY' } }),
        prisma.photo.count({ where: { driverId, kind: 'DAILY', status: 'VERIFIED' } }),
        prisma.photo.count({ where: { driverId, kind: 'DAILY', status: 'REJECTED' } }),
        prisma.photo.count({
          where: {
            driverId,
            kind: 'DAILY',
            status: 'REJECTED',
            createdAt: { gte: thirtyDaysAgo },
          },
        }),
        prisma.assignmentDay.count({
          where: {
            assignment: { driverId },
            status: DAY_STATUS.MISSED,
          },
        }),
      ]);

    const flags = photo.flags.map((f) => ({
      id: f.id,
      flaggedByRole: f.flaggedByRole,
      reason: f.reason as PhotoFlagReason,
      note: f.note,
      createdAt: f.createdAt.toISOString(),
    }));

    return {
      photo: {
        photoId: photo.id,
        assignmentId: photo.assignmentId,
        campaignId: photo.assignment.campaignId,
        campaignTitle: photo.assignment.campaign.title,
        driverId: photo.driverId,
        driverName: photo.driver.driverProfile?.fullName || null,
        driverMobile: photo.driver.mobile,
        vehicleRegistrationNumber: photo.assignment.vehicle.registrationNumber,
        cityName: photo.assignment.campaign.city?.name || 'General City',
        date: photo.photoDate ? toISTDate(photo.photoDate) : '',
        capturedAt: photo.capturedAt.toISOString(),
        photoUrl: photoSignedUrl,
        thumbnailUrl: photo.thumbnailUrl,
        reviewSource: (photo.reviewSource as PhotoReviewSource) || 'AUTO_FLAGGED',
        riskScore: photo.riskScore,
        autoCheckFlags: photo.autoCheckFlags as any,
        isSlaBreached,
        waitingMinutes,
        claimedById: photo.reviewClaimedById,
        claimedByName: null,
      },
      installationPhotoUrl: installPhotoSignedUrl,
      previousDayPhotoUrl: prevPhotoSignedUrl,
      posterPreviewUrl,
      driverStats: {
        totalSubmitted,
        verifiedCount,
        rejectedCount,
        missedDaysCount,
        recentRejectionCount30d,
      },
      flags,
    };
  }

  /**
   * Moderator/SuperAdmin manual review decision: APPROVE or REJECT.
   */
  static async decide(
    adminUserId: string,
    photoId: string,
    input: ReviewDailyPhotoInput,
  ): Promise<{ status: string; dayStatus: string }> {
    const photo = await prisma.photo.findUnique({
      where: { id: photoId },
      include: {
        assignment: true,
      },
    });

    if (!photo || photo.kind !== 'DAILY') {
      throw new AppError(ERROR_CODES.NOT_FOUND, 404, 'Daily photo not found');
    }

    const now = TimeService.now();
    const photoDateStr = photo.photoDate ? toISTDate(photo.photoDate) : toISTDate(photo.capturedAt);
    const dayUtc = new Date(`${photoDateStr}T00:00:00.000Z`);

    if (input.decision === 'APPROVE') {
      await prisma.$transaction(async (tx) => {
        await tx.photo.update({
          where: { id: photoId },
          data: {
            status: DAILY_PHOTO_STATUS.VERIFIED,
            reviewedByUserId: adminUserId,
            reviewedAt: now,
            reviewClaimedById: null,
            reviewClaimedAt: null,
          },
        });

        await tx.assignmentDay.upsert({
          where: {
            assignmentId_date: {
              assignmentId: photo.assignmentId,
              date: dayUtc,
            },
          },
          create: {
            assignmentId: photo.assignmentId,
            date: dayUtc,
            status: DAY_STATUS.VERIFIED,
            verifiedPhotoId: photoId,
            statusChangedAt: now,
          },
          update: {
            status: DAY_STATUS.VERIFIED,
            verifiedPhotoId: photoId,
            statusChangedAt: now,
          },
        });

        // Resolve open flags on this photo
        await tx.photoFlag.updateMany({
          where: { photoId, status: PHOTO_FLAG_STATUSES.OPEN },
          data: {
            status: PHOTO_FLAG_STATUSES.RESOLVED_INVALID,
            resolvedById: adminUserId,
            resolvedAt: now,
            resolutionNote: 'Approved in manual review by admin',
          },
        });
      });

      await AssignmentDaysService.recomputeCounters(photo.assignmentId);

      await AuditService.log({
        actorId: adminUserId,
        actorType: ACTOR_TYPES.USER,
        action: 'daily_photo.approved',
        entityType: 'Photo',
        entityId: photoId,
        newValues: {
          decision: 'APPROVE',
          note: input.note,
        },
      });

      eventBus.emit('photo.verified', {
        photoId,
        assignmentId: photo.assignmentId,
        driverId: photo.driverId,
        date: photoDateStr,
        autoVerified: false,
      });

      return {
        status: DAILY_PHOTO_STATUS.VERIFIED,
        dayStatus: DAY_STATUS.VERIFIED,
      };
    } else {
      // REJECT
      const lateGraceHours = await SettingsService.get(SETTING_KEYS.DAILY_PHOTO_LATE_GRACE_HOURS).catch(() => 12);
      const isPastCutoff = isDayCutoffPassed(photoDateStr, now, lateGraceHours);

      const result = await prisma.$transaction(async (tx) => {
        await tx.photo.update({
          where: { id: photoId },
          data: {
            status: DAILY_PHOTO_STATUS.REJECTED,
            reviewReasonCodes: input.reasons as any,
            reviewedByUserId: adminUserId,
            reviewedAt: now,
            reviewClaimedById: null,
            reviewClaimedAt: null,
          },
        });

        // Check if there are other verified photos for this day
        const otherVerified = await tx.photo.findFirst({
          where: {
            assignmentId: photo.assignmentId,
            kind: 'DAILY',
            photoDate: dayUtc,
            status: DAILY_PHOTO_STATUS.VERIFIED,
          },
        });

        let nextDayStatus: string;
        let verifiedPhotoId: string | null = null;

        if (otherVerified) {
          nextDayStatus = DAY_STATUS.VERIFIED;
          verifiedPhotoId = otherVerified.id;
        } else {
          // Check if other photos are under review
          const otherUnderReview = await tx.photo.findFirst({
            where: {
              assignmentId: photo.assignmentId,
              kind: 'DAILY',
              photoDate: dayUtc,
              status: DAILY_PHOTO_STATUS.MANUAL_REVIEW,
            },
          });

          if (otherUnderReview) {
            nextDayStatus = DAY_STATUS.UNDER_REVIEW;
          } else if (isPastCutoff) {
            nextDayStatus = DAY_STATUS.MISSED;
          } else {
            nextDayStatus = DAY_STATUS.PENDING;
          }
        }

        await tx.assignmentDay.upsert({
          where: {
            assignmentId_date: {
              assignmentId: photo.assignmentId,
              date: dayUtc,
            },
          },
          create: {
            assignmentId: photo.assignmentId,
            date: dayUtc,
            status: nextDayStatus as any,
            verifiedPhotoId,
            statusChangedAt: now,
          },
          update: {
            status: nextDayStatus as any,
            verifiedPhotoId,
            statusChangedAt: now,
          },
        });

        // Resolve open flags as VALID_FLAG
        await tx.photoFlag.updateMany({
          where: { photoId, status: PHOTO_FLAG_STATUSES.OPEN },
          data: {
            status: PHOTO_FLAG_STATUSES.RESOLVED_VALID,
            resolvedById: adminUserId,
            resolvedAt: now,
            resolutionNote: input.note || 'Rejected by admin',
          },
        });

        return { nextDayStatus };
      });

      await AssignmentDaysService.recomputeCounters(photo.assignmentId);

      await AuditService.log({
        actorId: adminUserId,
        actorType: ACTOR_TYPES.USER,
        action: 'daily_photo.rejected',
        entityType: 'Photo',
        entityId: photoId,
        newValues: {
          decision: 'REJECT',
          reasons: input.reasons,
          note: input.note,
          dayStatus: result.nextDayStatus,
        },
      });

      eventBus.emit('photo.rejected', {
        photoId,
        assignmentId: photo.assignmentId,
        driverId: photo.driverId,
        date: photoDateStr,
        reasons: input.reasons,
      });

      // Check for fraud-related rejection reasons
      const fraudReasons = ['WRONG_VEHICLE', 'NO_POSTER', 'POSTER_DAMAGED_OR_TAMPERED', 'FAKE_OR_SCREEN'];
      const isFraudSuspicion = input.reasons.some((r) => fraudReasons.includes(r.code));
      if (isFraudSuspicion) {
        eventBus.emit('photo.fraud_suspected', {
          photoId,
          assignmentId: photo.assignmentId,
          driverId: photo.driverId,
          reason: input.reasons.map((r) => r.code).join(', '),
          details: { riskScore: photo.riskScore },
        });
      }

      return {
        status: DAILY_PHOTO_STATUS.REJECTED,
        dayStatus: result.nextDayStatus,
      };
    }
  }

  /**
   * Excuse an assignment day (admin override).
   */
  static async excuseDay(
    adminUserId: string,
    assignmentId: string,
    dateStr: string,
    reason: string,
  ): Promise<void> {
    await AssignmentDaysService.excuseDay(assignmentId, dateStr, reason, adminUserId);
  }

  /**
   * Fraud overview statistics for moderators and super admins.
   */
  static async getFraudOverview(): Promise<FraudOverviewDto> {
    const now = TimeService.now();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 86400000);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 86400000);

    const [
      flagCount7d,
      autoFlaggedCount7d,
      rejectedCount7d,
      flagCount30d,
      autoFlaggedCount30d,
      rejectedCount30d,
    ] = await Promise.all([
      prisma.photoFlag.count({ where: { createdAt: { gte: sevenDaysAgo } } }),
      prisma.photo.count({
        where: {
          kind: 'DAILY',
          reviewSource: 'AUTO_FLAGGED',
          createdAt: { gte: sevenDaysAgo },
        },
      }),
      prisma.photo.count({
        where: {
          kind: 'DAILY',
          status: 'REJECTED',
          createdAt: { gte: sevenDaysAgo },
        },
      }),
      prisma.photoFlag.count({ where: { createdAt: { gte: thirtyDaysAgo } } }),
      prisma.photo.count({
        where: {
          kind: 'DAILY',
          reviewSource: 'AUTO_FLAGGED',
          createdAt: { gte: thirtyDaysAgo },
        },
      }),
      prisma.photo.count({
        where: {
          kind: 'DAILY',
          status: 'REJECTED',
          createdAt: { gte: thirtyDaysAgo },
        },
      }),
    ]);

    // Top flagged drivers in 30 days
    const recentFlags = await prisma.photoFlag.findMany({
      where: { createdAt: { gte: thirtyDaysAgo } },
      include: {
        photo: {
          select: {
            driverId: true,
            driver: {
              select: {
                driverProfile: { select: { fullName: true } },
              },
            },
          },
        },
      },
    });

    const driverFlagMap = new Map<string, { name: string; flagCount: number }>();
    for (const flag of recentFlags) {
      if (flag.photo?.driverId) {
        const current = driverFlagMap.get(flag.photo.driverId) || {
          name: flag.photo.driver?.driverProfile?.fullName || 'Unknown Driver',
          flagCount: 0,
        };
        current.flagCount++;
        driverFlagMap.set(flag.photo.driverId, current);
      }
    }

    const topDriverIds = Array.from(driverFlagMap.keys()).slice(0, 10);
    const driverRejections = await prisma.photo.groupBy({
      by: ['driverId'],
      where: {
        driverId: { in: topDriverIds },
        kind: 'DAILY',
        status: 'REJECTED',
        createdAt: { gte: thirtyDaysAgo },
      },
      _count: true,
    });
    const rejectionMap = new Map(driverRejections.map((r) => [r.driverId, r._count]));

    const topFlaggedDrivers = topDriverIds.map((driverId) => {
      const data = driverFlagMap.get(driverId)!;
      return {
        driverId,
        driverName: data.name,
        flagCount: data.flagCount,
        rejectCount: rejectionMap.get(driverId) || 0,
      };
    });

    return {
      summary7d: {
        flagCount: flagCount7d,
        autoFlaggedCount: autoFlaggedCount7d,
        rejectedCount: rejectedCount7d,
      },
      summary30d: {
        flagCount: flagCount30d,
        autoFlaggedCount: autoFlaggedCount30d,
        rejectedCount: rejectedCount30d,
      },
      topFlaggedDrivers,
      sharedDevices: [],
      stationaryAssignments: [],
      nearDuplicateClusters: [],
    };
  }

  /**
   * Computes driver trust tier and detailed verification stats.
   */
  static async getDriverTrust(driverId: string): Promise<{
    driverId: string;
    trustTier: 'TRUSTED' | 'STANDARD' | 'RISKY' | 'PROBATION';
    totalSubmitted: number;
    verifiedCount: number;
    rejectedCount: number;
    recentRejectionCount30d: number;
    avgRiskScore: number;
  }> {
    const now = TimeService.now();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 86400000);

    const [totalSubmitted, verifiedCount, rejectedCount, recentRejectionCount30d, avgRisk] =
      await Promise.all([
        prisma.photo.count({ where: { driverId, kind: 'DAILY' } }),
        prisma.photo.count({ where: { driverId, kind: 'DAILY', status: 'VERIFIED' } }),
        prisma.photo.count({ where: { driverId, kind: 'DAILY', status: 'REJECTED' } }),
        prisma.photo.count({
          where: {
            driverId,
            kind: 'DAILY',
            status: 'REJECTED',
            createdAt: { gte: thirtyDaysAgo },
          },
        }),
        prisma.photo.aggregate({
          where: { driverId, kind: 'DAILY' },
          _avg: { riskScore: true },
        }),
      ]);

    const avgRiskScore = Math.round(avgRisk._avg.riskScore || 0);

    let trustTier: 'TRUSTED' | 'STANDARD' | 'RISKY' | 'PROBATION' = 'STANDARD';
    if (recentRejectionCount30d >= 3 || avgRiskScore > 70) {
      trustTier = 'PROBATION';
    } else if (recentRejectionCount30d >= 2 || avgRiskScore > 40) {
      trustTier = 'RISKY';
    } else if (totalSubmitted >= 20 && rejectedCount === 0 && avgRiskScore <= 15) {
      trustTier = 'TRUSTED';
    }

    return {
      driverId,
      trustTier,
      totalSubmitted,
      verifiedCount,
      rejectedCount,
      recentRejectionCount30d,
      avgRiskScore,
    };
  }
}
