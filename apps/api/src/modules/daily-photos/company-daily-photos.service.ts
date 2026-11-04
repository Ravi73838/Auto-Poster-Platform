import { prisma } from '../../shared/db/index.js';
import {
  DAY_STATUS,
  ERROR_CODES,
  ACTOR_TYPES,
  DAILY_PHOTO_STATUS,
  PHOTO_FLAG_STATUSES,
  type PhotoFlagStatus,
} from '@ap/shared-constants';
import { AppError } from '../../shared/errors/index.js';
import { TimeService, toISTDate, todayIST } from '../../shared/time/index.js';
import { AuditService } from '../audit/audit.service.js';
import { eventBus } from '../../events/index.js';
import { storageProvider } from '../../integrations/storage/index.js';
import { AssignmentDaysService } from '../assignment-days/assignment-days.service.js';
import type { FlagPhotoInput } from '@ap/shared-validation';
import type {
  CompanyCampaignProgressDto,
  CompanyDailyPhotoDto,
} from '@ap/shared-types';

export class CompanyDailyPhotosService {
  /**
   * Validates company ownership of a campaign.
   */
  private static async verifyCampaignOwnership(companyUserId: string, campaignId: string) {
    const campaign = await prisma.campaign.findUnique({
      where: { id: campaignId },
      include: {
        campaignZones: { include: { zone: true } },
      },
    });

    if (!campaign) {
      throw new AppError(ERROR_CODES.CAMPAIGN_NOT_FOUND, 404, 'Campaign not found');
    }

    if (campaign.companyId !== companyUserId) {
      throw new AppError(ERROR_CODES.FORBIDDEN, 403, 'You do not own this campaign');
    }

    return campaign;
  }

  /**
   * Generates progress analytics, daily trend series, and zone breakdown for a campaign.
   */
  static async getProgress(
    companyUserId: string,
    campaignId: string,
  ): Promise<CompanyCampaignProgressDto> {
    const campaign = await this.verifyCampaignOwnership(companyUserId, campaignId);
    const todayStr = todayIST();
    const todayUtc = new Date(`${todayStr}T00:00:00.000Z`);

    const [totalVehicles, runningVehicles] = await Promise.all([
      prisma.assignment.count({
        where: {
          campaignId,
          status: { in: ['RESERVED', 'INSTALLING', 'INSTALL_SUBMITTED', 'INSTALL_APPROVED', 'RUNNING', 'COMPLETED', 'PAID'] },
        },
      }),
      prisma.assignment.count({
        where: {
          campaignId,
          status: 'RUNNING',
        },
      }),
    ]);

    // Ensure today's day rows exist for all running assignments
    const runningAssignments = await prisma.assignment.findMany({
      where: { campaignId, status: 'RUNNING' },
      select: {
        id: true,
        driverId: true,
        driver: {
          select: {
            driverProfile: {
              select: {
                driverZones: {
                  select: { zoneId: true },
                },
              },
            },
          },
        },
      },
    });

    for (const a of runningAssignments) {
      await AssignmentDaysService.ensureDayRows(a.id, todayStr);
    }

    // Today's stats
    const todayDays = await prisma.assignmentDay.findMany({
      where: {
        assignment: { campaignId, status: 'RUNNING' },
        date: todayUtc,
      },
    });

    const todayExpectedPhotos = runningVehicles;
    const todayVerifiedPhotos = todayDays.filter((d) => d.status === DAY_STATUS.VERIFIED).length;
    const todayCoveragePercent =
      todayExpectedPhotos > 0
        ? Math.round((todayVerifiedPhotos / todayExpectedPhotos) * 100)
        : 0;

    // Overall aggregate across past days
    const allDays = await prisma.assignmentDay.findMany({
      where: {
        assignment: { campaignId },
      },
    });

    const totalDaysCount = allDays.length;
    const totalVerifiedCount = allDays.filter((d) => d.status === DAY_STATUS.VERIFIED || d.status === DAY_STATUS.EXCUSED).length;
    const totalMissedCount = allDays.filter((d) => d.status === DAY_STATUS.MISSED).length;

    const overallCoveragePercent =
      totalDaysCount > 0 ? Math.round((totalVerifiedCount / totalDaysCount) * 100) : 0;
    const overallMissedRatePercent =
      totalDaysCount > 0 ? Math.round((totalMissedCount / totalDaysCount) * 100) : 0;

    // Daily series (group by date)
    const dateMap = new Map<
      string,
      { expected: number; verified: number; underReview: number; missed: number }
    >();

    for (const d of allDays) {
      const dateKey = toISTDate(d.date);
      const entry = dateMap.get(dateKey) || {
        expected: 0,
        verified: 0,
        underReview: 0,
        missed: 0,
      };
      entry.expected++;
      if (d.status === DAY_STATUS.VERIFIED || d.status === DAY_STATUS.EXCUSED) {
        entry.verified++;
      } else if (d.status === DAY_STATUS.UNDER_REVIEW) {
        entry.underReview++;
      } else if (d.status === DAY_STATUS.MISSED) {
        entry.missed++;
      }
      dateMap.set(dateKey, entry);
    }

    const sortedDates = Array.from(dateMap.keys()).sort();
    const dailySeries = sortedDates.map((date) => {
      const counts = dateMap.get(date)!;
      return {
        date,
        expected: counts.expected,
        verified: counts.verified,
        underReview: counts.underReview,
        missed: counts.missed,
      };
    });

    // Zone breakdown
    const zoneMap = new Map<string, { zoneName: string; vehicleCount: number; verifiedToday: number }>();
    for (const cz of campaign.campaignZones) {
      zoneMap.set(cz.zoneId, {
        zoneName: cz.zone.name,
        vehicleCount: 0,
        verifiedToday: 0,
      });
    }

    const verifiedTodayAssignmentIds = new Set(
      todayDays.filter((d) => d.status === DAY_STATUS.VERIFIED).map((d) => d.assignmentId),
    );

    for (const a of runningAssignments) {
      const driverZones = a.driver?.driverProfile?.driverZones || [];
      const zId = driverZones[0]?.zoneId;
      if (zId && zoneMap.has(zId)) {
        const item = zoneMap.get(zId)!;
        item.vehicleCount++;
        if (verifiedTodayAssignmentIds.has(a.id)) {
          item.verifiedToday++;
        }
      }
    }

    const zoneBreakdown = Array.from(zoneMap.entries()).map(([zoneId, data]) => ({
      zoneId,
      zoneName: data.zoneName,
      vehicleCount: data.vehicleCount,
      verifiedToday: data.verifiedToday,
    }));

    return {
      campaignId,
      totalVehicles,
      runningVehicles,
      todayExpectedPhotos,
      todayVerifiedPhotos,
      todayCoveragePercent,
      overallCoveragePercent,
      overallMissedRatePercent,
      dailySeries,
      zoneBreakdown,
    };
  }

  /**
   * Lists daily proof photos for a campaign with anonymized driver data and rounded coords.
   */
  static async listPhotos(
    companyUserId: string,
    campaignId: string,
    page: number = 1,
    limit: number = 20,
    date?: string,
  ): Promise<{ items: CompanyDailyPhotoDto[]; total: number }> {
    await this.verifyCampaignOwnership(companyUserId, campaignId);

    const where: any = {
      kind: 'DAILY',
      assignment: { campaignId },
      status: { in: [DAILY_PHOTO_STATUS.VERIFIED, DAILY_PHOTO_STATUS.MANUAL_REVIEW] },
    };

    if (date) {
      where.photoDate = new Date(`${date}T00:00:00.000Z`);
    }

    const skip = (page - 1) * limit;
    const [photos, total] = await Promise.all([
      prisma.photo.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ photoDate: 'desc' }, { uploadedAt: 'desc' }],
        include: {
          assignment: {
            include: {
              vehicle: true,
              driver: {
                select: {
                  driverProfile: {
                    select: {
                      driverZones: {
                        include: { zone: true },
                      },
                    },
                  },
                },
              },
            },
          },
          flags: {
            where: { flaggedById: companyUserId },
          },
        },
      }),
      prisma.photo.count({ where }),
    ]);

    const items: CompanyDailyPhotoDto[] = await Promise.all(
      photos.map(async (p) => {
        let thumbUrl = p.thumbnailUrl || p.photoUrl;
        try {
          thumbUrl = await storageProvider.getSignedReadUrl(thumbUrl, 3600);
        } catch {}

        // Privacy: round coordinates to 3 decimals (~110 meters)
        const approxLat = Math.round(p.lat * 1000) / 1000;
        const approxLng = Math.round(p.lng * 1000) / 1000;

        // Privacy: Anonymize driver identity with masked vehicle registration
        const reg = p.assignment.vehicle.registrationNumber;
        const driverCode = `Auto-${reg.slice(-4)}`;

        const userFlag = p.flags[0];
        const driverZones = p.assignment.driver?.driverProfile?.driverZones || [];
        const zoneName = driverZones[0]?.zone.name || 'General Zone';

        return {
          id: p.id,
          date: p.photoDate ? toISTDate(p.photoDate) : toISTDate(p.capturedAt),
          zoneName,
          approxLat,
          approxLng,
          thumbnailUrl: thumbUrl,
          driverCode,
          status: p.status,
          isFlagged: !!userFlag,
          flagStatus: (userFlag?.status as PhotoFlagStatus) || null,
        };
      }),
    );

    return { items, total };
  }

  /**
   * Returns GPS points for map view, rounded to 3 decimal places (~110m).
   */
  static async getMapPoints(
    companyUserId: string,
    campaignId: string,
    date?: string,
  ): Promise<
    Array<{
      id: string;
      approxLat: number;
      approxLng: number;
      driverCode: string;
      thumbnailUrl: string;
      capturedAt: string;
      status: string;
    }>
  > {
    await this.verifyCampaignOwnership(companyUserId, campaignId);

    const targetDate = date || todayIST();
    const dayUtc = new Date(`${targetDate}T00:00:00.000Z`);

    const photos = await prisma.photo.findMany({
      where: {
        kind: 'DAILY',
        assignment: { campaignId },
        photoDate: dayUtc,
        status: { in: [DAILY_PHOTO_STATUS.VERIFIED, DAILY_PHOTO_STATUS.MANUAL_REVIEW] },
      },
      include: {
        assignment: {
          include: {
            vehicle: true,
          },
        },
      },
    });

    return Promise.all(
      photos.map(async (p) => {
        let thumbUrl = p.thumbnailUrl || p.photoUrl;
        try {
          thumbUrl = await storageProvider.getSignedReadUrl(thumbUrl, 3600);
        } catch {}

        const approxLat = Math.round(p.lat * 1000) / 1000;
        const approxLng = Math.round(p.lng * 1000) / 1000;
        const reg = p.assignment.vehicle.registrationNumber;
        const driverCode = `Auto-${reg.slice(-4)}`;

        return {
          id: p.id,
          approxLat,
          approxLng,
          driverCode,
          thumbnailUrl: thumbUrl,
          capturedAt: p.capturedAt.toISOString(),
          status: p.status,
        };
      }),
    );
  }

  /**
   * Allows a company to flag a photo as suspicious or invalid.
   */
  static async flagPhoto(
    companyUserId: string,
    campaignId: string,
    photoId: string,
    input: FlagPhotoInput,
  ): Promise<{ flagId: string; status: string }> {
    await this.verifyCampaignOwnership(companyUserId, campaignId);

    const photo = await prisma.photo.findUnique({
      where: { id: photoId },
      include: { assignment: true },
    });

    if (!photo || photo.kind !== 'DAILY' || photo.assignment.campaignId !== campaignId) {
      throw new AppError(ERROR_CODES.NOT_FOUND, 404, 'Daily photo not found for this campaign');
    }

    // Check for existing pending flag by this company
    const existingPendingFlag = await prisma.photoFlag.findFirst({
      where: {
        photoId,
        flaggedById: companyUserId,
        status: PHOTO_FLAG_STATUSES.OPEN,
      },
    });

    if (existingPendingFlag) {
      throw new AppError(
        ERROR_CODES.CONFLICT,
        409,
        'You already have a pending flag for this photo.',
      );
    }

    const now = TimeService.now();
    const photoDateStr = photo.photoDate ? toISTDate(photo.photoDate) : toISTDate(photo.capturedAt);
    const dayUtc = new Date(`${photoDateStr}T00:00:00.000Z`);

    const flag = await prisma.$transaction(async (tx) => {
      const createdFlag = await tx.photoFlag.create({
        data: {
          photoId,
          flaggedById: companyUserId,
          flaggedByRole: 'COMPANY',
          reason: input.reason,
          note: input.note,
          status: PHOTO_FLAG_STATUSES.OPEN,
        },
      });

      // Update photo to manual review and mark source as COMPANY_FLAG
      await tx.photo.update({
        where: { id: photoId },
        data: {
          status: DAILY_PHOTO_STATUS.MANUAL_REVIEW,
          reviewSource: 'COMPANY_FLAG',
        },
      });

      // Update assignment day to UNDER_REVIEW
      await tx.assignmentDay.updateMany({
        where: {
          assignmentId: photo.assignmentId,
          date: dayUtc,
        },
        data: {
          status: DAY_STATUS.UNDER_REVIEW,
          statusChangedAt: now,
        },
      });

      return createdFlag;
    });

    await AssignmentDaysService.recomputeCounters(photo.assignmentId);

    await AuditService.log({
      actorId: companyUserId,
      actorType: ACTOR_TYPES.USER,
      action: 'daily_photo.flagged_by_company',
      entityType: 'PhotoFlag',
      entityId: flag.id,
      newValues: {
        photoId,
        campaignId,
        reason: input.reason,
        note: input.note,
      },
    });

    eventBus.emit('photo.flagged', {
      flagId: flag.id,
      photoId,
      campaignId,
      assignmentId: photo.assignmentId,
      flaggedById: companyUserId,
      reason: input.reason,
    });

    return {
      flagId: flag.id,
      status: PHOTO_FLAG_STATUSES.OPEN,
    };
  }

  /**
   * Generates CSV report of campaign daily proof coverage.
   */
  static async generateCsvReport(companyUserId: string, campaignId: string): Promise<string> {
    const progress = await this.getProgress(companyUserId, campaignId);

    const headers = ['Date', 'Expected Autos', 'Verified Autos', 'Under Review', 'Missed Autos', 'Daily Compliance %'];
    const rows = progress.dailySeries.map((s) => {
      const compliance = s.expected > 0 ? Math.round((s.verified / s.expected) * 100) : 0;
      return [
        s.date,
        s.expected.toString(),
        s.verified.toString(),
        s.underReview.toString(),
        s.missed.toString(),
        `${compliance}%`,
      ].join(',');
    });

    return [headers.join(','), ...rows].join('\n');
  }
}
