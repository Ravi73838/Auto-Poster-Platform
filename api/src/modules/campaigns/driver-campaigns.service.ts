import { prisma } from '../../shared/db/index.js';
import {
  CAMPAIGN_STATUS,
  CAMPAIGN_SORTS,
  ACCOUNT_STATUS,
  ROLES,
  ERROR_CODES,
  VEHICLE_TYPES,
  type VehicleType,
} from '@ap/shared-constants';
import { AppError } from '../../shared/errors/index.js';
import { SlotsService } from './slots.service.js';
import { FileAccessService } from '../uploads/uploads.service.js';
import { features } from '../../config/features.js';
import {
  toISTDate,
  diffDaysIST,
  TimeService,
} from '../../shared/time/index.js';
import type { ListDriverCampaignsQuery } from '@ap/shared-validation';
import type { DriverCampaignDto } from '@ap/shared-types';

export class DriverCampaignsService {
  /**
   * Driver discovery: lists LIVE or RUNNING campaigns matching driver's city, zones, and vehicle.
   */
  static async list(
    driverUserId: string,
    query: ListDriverCampaignsQuery,
  ): Promise<{ items: DriverCampaignDto[]; isBanned?: boolean }> {
    const now = TimeService.now();

    // 1. Load driver profile, zones, approved vehicles, and active assignments
    const driver = await prisma.user.findUnique({
      where: { id: driverUserId },
      include: {
        driverProfile: {
          include: {
            driverZones: true,
            currentVehicle: true,
          },
        },
        assignments: {
          where: {
            status: {
              notIn: ['RESERVATION_EXPIRED', 'TERMINATED', 'COMPLETED', 'PAID'] as any,
            },
          },
        },
      },
    });

    if (!driver || !driver.driverProfile || !driver.driverProfile.cityId) {
      return { items: [] };
    }

    // 2. Check if driver is currently banned/suspended
    if (driver.status === ACCOUNT_STATUS.SUSPENDED || driver.status === ACCOUNT_STATUS.BLOCKED) {
      return { items: [], isBanned: true };
    }

    const driverCityId = driver.driverProfile.cityId;
    const driverZoneIds = new Set(driver.driverProfile.driverZones.map((z: any) => z.zoneId));
    const vehicleType = driver.driverProfile.currentVehicle?.vehicleType ?? VEHICLE_TYPES.AUTO_RICKSHAW;
    const hasActiveAssignment = driver.assignments.length > 0;

    // 3. Build campaign query
    const where: any = {
      status: { in: [CAMPAIGN_STATUS.LIVE, CAMPAIGN_STATUS.RUNNING] },
      cityId: driverCityId,
      deletedAt: null,
      targetVehicleType: vehicleType,
    };

    if (query.zoneId) {
      where.campaignZones = { some: { zoneId: query.zoneId } };
    }
    if (query.minRent) {
      where.dailyRentPaise = { gte: Math.round(query.minRent / 30) };
    }
    if (query.startDateFrom) {
      where.startDate = { gte: new Date(`${query.startDateFrom}T00:00:00.000Z`) };
    }
    if (query.startDateTo) {
      where.startDate = { ...where.startDate, lte: new Date(`${query.startDateTo}T23:59:59.999Z`) };
    }

    // Sorting
    let orderBy: any = { createdAt: 'desc' };
    if (query.sort === CAMPAIGN_SORTS.HIGHEST_RENT) {
      orderBy = { dailyRentPaise: 'desc' };
    } else if (query.sort === CAMPAIGN_SORTS.STARTING_SOON) {
      orderBy = { startDate: 'asc' };
    }

    const campaigns = await prisma.campaign.findMany({
      where,
      orderBy,
      take: query.limit ?? 20,
      include: {
        campaignZones: { include: { zone: true } },
        city: true,
        company: { include: { companyProfile: true } },
      },
    });

    const items: DriverCampaignDto[] = [];

    for (const campaign of campaigns) {
      // Zone rule:
      // If campaign has zones, driver must match at least one
      if (campaign.campaignZones.length > 0) {
        const matchesAnyZone = campaign.campaignZones.some((cz) => driverZoneIds.has(cz.zoneId));
        if (!matchesAnyZone) {
          continue;
        }
      }

      // Enrolment window check
      const isEnrolmentOpen = SlotsService.isEnrolmentOpen(campaign, now);
      if (!isEnrolmentOpen) {
        continue;
      }

      const startDateStr = toISTDate(campaign.startDate);
      const endDateStr = toISTDate(campaign.endDate);
      const durationDays = diffDaysIST(startDateStr, endDateStr);

      if (query.minDuration && durationDays < query.minDuration) {
        continue;
      }

      const slotUsage = await SlotsService.getSlotUsage(campaign.id);
      const slotsAvailable = slotUsage.available <= 10 ? slotUsage.available : '10+';

      // Selection eligibility check
      let canSelect = false;
      let cannotSelectReason: string | null = null;

      if (!features.campaignSelection) {
        canSelect = false;
        cannotSelectReason = 'COMING_SOON';
      } else if (hasActiveAssignment) {
        canSelect = false;
        cannotSelectReason = 'VEHICLE_HAS_ACTIVE_ASSIGNMENT';
      } else if (slotUsage.available <= 0) {
        canSelect = false;
        cannotSelectReason = 'CAMPAIGN_FULL';
      } else {
        canSelect = true;
      }

      // Rent and earnings calculations
      const rentForCampaignPaise = Number(
        (BigInt(campaign.dailyRentPaise * 30) * BigInt(durationDays) + 15n) / 30n,
      );
      const estimatedEarningsPaise = rentForCampaignPaise + campaign.printingAllowancePaise;

      // Sign poster thumbnail (never expose original)
      let posterThumbnailUrl: string | null = null;
      if (campaign.posterFileId) {
        try {
          const signed = await FileAccessService.getSignedUrl(
            campaign.posterFileId,
            { id: driverUserId, role: ROLES.DRIVER, status: ACCOUNT_STATUS.APPROVED, permissions: [] },
            { variant: 'thumbnail' },
          );
          posterThumbnailUrl = signed.url;
        } catch {
          posterThumbnailUrl = null;
        }
      }

      items.push({
        id: campaign.id,
        title: campaign.title,
        companyName: campaign.company.companyProfile?.companyName ?? 'Verified Advertiser',
        posterThumbnailUrl,
        startDate: startDateStr,
        endDate: endDateStr,
        durationDays,
        cityName: campaign.city?.name ?? 'Citywide',
        zoneNames: campaign.campaignZones.map((cz) => cz.zone.name),
        slotsAvailable,
        rentForCampaignPaise,
        printingAllowancePaise: campaign.printingAllowancePaise,
        estimatedEarningsPaise,
        canSelect,
        cannotSelectReason,
        printMaterial: campaign.printMaterial as any,
        printSize: campaign.printSize,
        printInstructions: campaign.printInstructions,
        rulesSummaryKeys: [
          'campaigns.rules.dailyPhotoRequired',
          'campaigns.rules.plateVisible',
          'campaigns.rules.fairKmRequired',
        ],
      });
    }

    return { items };
  }

  /**
   * Retrieves detail of a discoverable campaign for an approved driver.
   */
  static async getDetail(driverUserId: string, campaignId: string): Promise<DriverCampaignDto> {
    const now = TimeService.now();

    const driver = await prisma.user.findUnique({
      where: { id: driverUserId },
      include: {
        driverProfile: {
          include: {
            driverZones: true,
            currentVehicle: true,
          },
        },
        assignments: {
          where: {
            status: {
              notIn: ['RESERVATION_EXPIRED', 'TERMINATED', 'COMPLETED', 'PAID'] as any,
            },
          },
        },
      },
    });

    if (!driver || !driver.driverProfile?.cityId) {
      throw new AppError(ERROR_CODES.NOT_FOUND, 404, 'Driver profile not found');
    }

    const campaign = await prisma.campaign.findUnique({
      where: { id: campaignId },
      include: {
        campaignZones: { include: { zone: true } },
        city: true,
        company: { include: { companyProfile: true } },
      },
    });

    if (
      !campaign ||
      campaign.deletedAt !== null ||
      (campaign.status !== CAMPAIGN_STATUS.LIVE && campaign.status !== CAMPAIGN_STATUS.RUNNING)
    ) {
      throw new AppError(ERROR_CODES.CAMPAIGN_NOT_FOUND, 404, 'Campaign not found or not available');
    }

    // Must match city
    if (campaign.cityId !== driver.driverProfile.cityId) {
      throw new AppError(ERROR_CODES.FORBIDDEN, 403, 'This campaign is not available in your city');
    }

    const startDateStr = toISTDate(campaign.startDate);
    const endDateStr = toISTDate(campaign.endDate);
    const durationDays = diffDaysIST(startDateStr, endDateStr);

    const slotUsage = await SlotsService.getSlotUsage(campaign.id);
    const slotsAvailable = slotUsage.available <= 10 ? slotUsage.available : '10+';
    const hasActiveAssignment = driver.assignments.length > 0;

    let canSelect = false;
    let cannotSelectReason: string | null = null;
    if (!features.campaignSelection) {
      canSelect = false;
      cannotSelectReason = 'COMING_SOON';
    } else if (hasActiveAssignment) {
      canSelect = false;
      cannotSelectReason = 'VEHICLE_HAS_ACTIVE_ASSIGNMENT';
    } else if (slotUsage.available <= 0) {
      canSelect = false;
      cannotSelectReason = 'CAMPAIGN_FULL';
    } else {
      canSelect = true;
    }

    const rentForCampaignPaise = Number(
      (BigInt(campaign.dailyRentPaise * 30) * BigInt(durationDays) + 15n) / 30n,
    );
    const estimatedEarningsPaise = rentForCampaignPaise + campaign.printingAllowancePaise;

    let posterPreviewUrl: string | null = null;
    let posterThumbnailUrl: string | null = null;

    if (campaign.posterFileId) {
      const [prev, thumb] = await Promise.all([
        FileAccessService.getSignedUrl(
          campaign.posterFileId,
          { id: driverUserId, role: ROLES.DRIVER, status: ACCOUNT_STATUS.APPROVED, permissions: [] },
          { variant: 'preview' },
        ).catch(() => null),
        FileAccessService.getSignedUrl(
          campaign.posterFileId,
          { id: driverUserId, role: ROLES.DRIVER, status: ACCOUNT_STATUS.APPROVED, permissions: [] },
          { variant: 'thumbnail' },
        ).catch(() => null),
      ]);
      posterPreviewUrl = prev?.url ?? null;
      posterThumbnailUrl = thumb?.url ?? null;
    }

    return {
      id: campaign.id,
      title: campaign.title,
      companyName: campaign.company.companyProfile?.companyName ?? 'Verified Advertiser',
      posterThumbnailUrl,
      posterPreviewUrl,
      startDate: startDateStr,
      endDate: endDateStr,
      durationDays,
      cityName: campaign.city?.name ?? 'Citywide',
      zoneNames: campaign.campaignZones.map((cz) => cz.zone.name),
      slotsAvailable,
      rentForCampaignPaise,
      printingAllowancePaise: campaign.printingAllowancePaise,
      estimatedEarningsPaise,
      canSelect,
      cannotSelectReason,
      printMaterial: campaign.printMaterial as any,
      printSize: campaign.printSize,
      printInstructions: campaign.printInstructions,
      rulesSummaryKeys: [
        'campaigns.rules.dailyPhotoRequired',
        'campaigns.rules.plateVisible',
        'campaigns.rules.fairKmRequired',
      ],
    };
  }
}
