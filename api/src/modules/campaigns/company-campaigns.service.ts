import { prisma } from '../../shared/db/index.js';
import {
  CAMPAIGN_STATUS,
  SETTING_KEYS,
  ACTOR_TYPES,
  ERROR_CODES,
  ROLES,
  ACCOUNT_STATUS,
  FILE_STATUS,
  type CampaignStatus,
} from '@ap/shared-constants';
import { AppError } from '../../shared/errors/index.js';
import { campaignStateMachine } from './campaigns.state-machine.js';
import { calculateCampaignPricing } from '../../shared/money/index.js';
import {
  todayIST,
  toISTDate,
  addDaysIST,
  diffDaysIST,
  startOfISTDay,
  endOfISTDay,
  TimeService,
} from '../../shared/time/index.js';
import { SettingsService } from '../settings/settings.service.js';
import { AuditService } from '../audit/audit.service.js';
import { eventBus } from '../../events/index.js';
import { SlotsService } from './slots.service.js';
import type {
  CreateCampaignDraftInput,
  UpdateCampaignDraftInput,
  CampaignPricePreviewInput,
  ListCompanyCampaignsQuery,
} from '@ap/shared-validation';
import type {
  CampaignDto,
  CampaignDetailDto,
  CampaignPricePreviewDto,
  CampaignRulesDto,
  DriverAvailabilityDto,
} from '@ap/shared-types';

export class CompanyCampaignsService {
  /**
   * Retrieves active platform campaign configuration limits and checklist items.
   */
  static async getRules(): Promise<CampaignRulesDto> {
    const [
      maxSlots,
      minLeadDays,
      maxCampaignDays,
      minCampaignDays,
      minRent,
      maxRent,
      maxAllowance,
      maxPosterBytes,
      minPosterWidth,
      commissionBps,
      gstBps,
      defaultInstallApprover,
    ] = await Promise.all([
      SettingsService.get(SETTING_KEYS.MAX_SLOTS_PER_CAMPAIGN).catch(() => 500),
      SettingsService.get(SETTING_KEYS.MIN_LEAD_DAYS).catch(() => 3),
      SettingsService.get(SETTING_KEYS.MAX_CAMPAIGN_DAYS).catch(() => 90),
      SettingsService.get(SETTING_KEYS.MIN_CAMPAIGN_DAYS).catch(() => 15),
      SettingsService.get(SETTING_KEYS.MIN_RENT_PER_30_DAYS_PAISE).catch(() => 30000),
      SettingsService.get(SETTING_KEYS.MAX_RENT_PER_30_DAYS_PAISE).catch(() => 500000),
      SettingsService.get(SETTING_KEYS.MAX_PRINTING_ALLOWANCE_PAISE).catch(() => 50000),
      SettingsService.get(SETTING_KEYS.MAX_POSTER_UPLOAD_BYTES).catch(() => 26214400),
      SettingsService.get(SETTING_KEYS.MIN_POSTER_WIDTH_PX).catch(() => 1200),
      SettingsService.get(SETTING_KEYS.COMMISSION_BPS).catch(() => 2000),
      SettingsService.get(SETTING_KEYS.GST_BPS).catch(() => 1800),
      SettingsService.get(SETTING_KEYS.DEFAULT_INSTALL_APPROVER).catch(() => 'PLATFORM' as const),
    ]);

    return {
      minSlots: 1,
      maxSlots,
      minLeadDays,
      minCampaignDays,
      maxCampaignDays,
      minRentPer30DaysPaise: minRent,
      maxRentPer30DaysPaise: maxRent,
      maxPrintingAllowancePaise: maxAllowance,
      maxPosterUploadBytes: maxPosterBytes,
      minPosterWidthPx: minPosterWidth,
      commissionBps,
      gstBps,
      defaultInstallApprover,
      policyChecklist: [
        { key: 'policyCompliant', labelKey: 'campaigns.checklist.policyCompliant' },
        { key: 'highResolution', labelKey: 'campaigns.checklist.highResolution' },
        { key: 'driverSafety', labelKey: 'campaigns.checklist.driverSafety' },
        { key: 'accurateDates', labelKey: 'campaigns.checklist.accurateDates' },
      ],
    };
  }

  /**
   * Returns availability of eligible drivers in the target area.
   */
  static async getAvailability(
    cityId: string,
    zoneIds: string[] = [],
    vehicleType = 'AUTO_RICKSHAW',
  ): Promise<DriverAvailabilityDto> {
    const now = TimeService.now();

    // Query approved drivers in city with active vehicle not currently on an active campaign assignment
    const drivers = await prisma.user.findMany({
      where: {
        role: ROLES.DRIVER,
        status: ACCOUNT_STATUS.APPROVED,
        driverProfile: {
          cityId,
          isAvailable: true,
          currentVehicle: {
            vehicleType: vehicleType as any,
            isVerified: true,
          },
          ...(zoneIds.length > 0
            ? {
                driverZones: {
                  some: {
                    zoneId: { in: zoneIds },
                  },
                },
              }
            : {}),
        },
        assignments: {
          none: {
            status: {
              notIn: ['RESERVATION_EXPIRED', 'TERMINATED', 'COMPLETED', 'PAID'] as any,
            },
          },
        },
      },
      select: { id: true },
    });

    const count = drivers.length;
    let bucket: 'NONE' | 'FEW' | 'SOME' | 'MANY' = 'NONE';
    if (count === 0) bucket = 'NONE';
    else if (count <= 5) bucket = 'FEW';
    else if (count <= 20) bucket = 'SOME';
    else bucket = 'MANY';

    return { count, bucket };
  }

  /**
   * Pure price preview based on settings and server math.
   */
  static async calculatePricePreview(
    input: CampaignPricePreviewInput,
  ): Promise<CampaignPricePreviewDto> {
    const days = diffDaysIST(input.startDate, input.endDate);
    if (days <= 0) {
      throw new AppError(
        ERROR_CODES.CAMPAIGN_INVALID_DATES,
        400,
        'Campaign end date must be after start date',
      );
    }

    const [commissionBps, gstBps] = await Promise.all([
      SettingsService.get(SETTING_KEYS.COMMISSION_BPS).catch(() => 2000),
      SettingsService.get(SETTING_KEYS.GST_BPS).catch(() => 1800),
    ]);

    const pricing = calculateCampaignPricing({
      targetAutoCount: input.slots,
      days,
      rentPer30DaysPaise: input.rentPer30DaysPaise,
      printingAllowancePaise: input.printingAllowancePaise,
      commissionRateBps: commissionBps,
      gstRateBps: gstBps,
    });

    const rentPerAutoPaise = Number((BigInt(input.rentPer30DaysPaise) * BigInt(days) + 15n) / 30n);

    return {
      slots: input.slots,
      days,
      rentPer30DaysPaise: input.rentPer30DaysPaise,
      rentForCampaignPerAutoPaise: rentPerAutoPaise,
      printingAllowancePaise: input.printingAllowancePaise,
      driverRentTotalPaise: pricing.driverRentTotalPaise.toString(),
      driverPrintingTotalPaise: pricing.driverPrintingTotalPaise.toString(),
      totalBudgetPaise: pricing.totalBudgetPaise.toString(),
      commissionBps,
      platformFeePaise: pricing.platformFeePaise.toString(),
      gstBps,
      gstAmountPaise: pricing.gstAmountPaise.toString(),
      totalChargedPaise: pricing.totalChargedPaise.toString(),
      perAutoBreakdown: {
        rentPaise: rentPerAutoPaise,
        allowancePaise: input.printingAllowancePaise,
        totalPerAutoPaise: rentPerAutoPaise + input.printingAllowancePaise,
      },
    };
  }

  /**
   * Creates a new campaign in DRAFT status.
   */
  static async createDraft(
    companyId: string,
    input: CreateCampaignDraftInput,
  ): Promise<CampaignDto> {
    const preview = await this.calculatePricePreview({
      slots: input.slots,
      rentPer30DaysPaise: input.rentPer30DaysPaise,
      printingAllowancePaise: input.printingAllowancePaise,
      startDate: input.startDate,
      endDate: input.endDate,
    });

    const startDate = startOfISTDay(input.startDate);
    const endDate = endOfISTDay(input.endDate);

    const campaign = await prisma.campaign.create({
      data: {
        companyId,
        title: input.title,
        description: input.description,
        cityId: input.cityId,
        targetVehicleType: input.targetVehicleType,
        targetAutoCount: input.slots,
        startDate,
        endDate,
        dailyRentPaise: Math.round(input.rentPer30DaysPaise / 30),
        printingAllowancePaise: input.printingAllowancePaise,
        totalBudgetPaise: BigInt(preview.totalBudgetPaise),
        platformFeePaise: BigInt(preview.platformFeePaise),
        gstAmountPaise: BigInt(preview.gstAmountPaise),
        totalChargedPaise: BigInt(preview.totalChargedPaise),
        status: CAMPAIGN_STATUS.DRAFT,
        installApprover: input.installApprover,
        printMaterial: input.printMaterial,
        printSize: input.printSize,
        printInstructions: input.printInstructions,
        posterFileId: input.posterFileId,
        enrolmentClosesAt: input.enrolmentClosesAt ? new Date(input.enrolmentClosesAt) : null,
        pricingSnapshot: preview as any,
        campaignZones: {
          create: (input.zoneIds ?? []).map((zoneId) => ({ zoneId })),
        },
      },
      include: {
        campaignZones: { include: { zone: true } },
        city: true,
      },
    });

    await AuditService.log({
      actorId: companyId,
      actorType: ACTOR_TYPES.USER,
      action: 'campaign.created',
      entityType: 'Campaign',
      entityId: campaign.id,
      newValues: { title: campaign.title, status: campaign.status },
    });

    return this.mapToDto(campaign);
  }

  /**
   * Updates an existing DRAFT campaign.
   */
  static async updateDraft(
    companyId: string,
    campaignId: string,
    input: UpdateCampaignDraftInput,
  ): Promise<CampaignDto> {
    const campaign = await prisma.campaign.findUnique({
      where: { id: campaignId },
      include: { campaignZones: true },
    });

    if (!campaign) {
      throw new AppError(ERROR_CODES.CAMPAIGN_NOT_FOUND, 404, 'Campaign not found');
    }

    if (campaign.companyId !== companyId) {
      throw new AppError(ERROR_CODES.FORBIDDEN, 403, 'You do not own this campaign');
    }

    if (campaign.status !== CAMPAIGN_STATUS.DRAFT) {
      throw new AppError(
        ERROR_CODES.CAMPAIGN_NOT_EDITABLE,
        400,
        `Campaign cannot be edited in status ${campaign.status}. Only DRAFT campaigns can be modified.`,
      );
    }

    const startDateStr = input.startDate ?? toISTDate(campaign.startDate);
    const endDateStr = input.endDate ?? toISTDate(campaign.endDate);
    const slots = input.slots ?? campaign.targetAutoCount;
    const rentPer30DaysPaise = input.rentPer30DaysPaise ?? (campaign.dailyRentPaise * 30);
    const printingAllowancePaise = input.printingAllowancePaise ?? campaign.printingAllowancePaise;

    const preview = await this.calculatePricePreview({
      slots,
      rentPer30DaysPaise,
      printingAllowancePaise,
      startDate: startDateStr,
      endDate: endDateStr,
    });

    // Update zone associations if provided
    if (input.zoneIds) {
      await prisma.campaignZone.deleteMany({ where: { campaignId } });
      await prisma.campaignZone.createMany({
        data: input.zoneIds.map((zoneId) => ({ campaignId, zoneId })),
      });
    }

    const updated = await prisma.campaign.update({
      where: { id: campaignId },
      data: {
        title: input.title ?? campaign.title,
        description: input.description !== undefined ? input.description : campaign.description,
        cityId: input.cityId ?? campaign.cityId,
        targetVehicleType: input.targetVehicleType ?? campaign.targetVehicleType,
        targetAutoCount: slots,
        startDate: input.startDate ? startOfISTDay(input.startDate) : campaign.startDate,
        endDate: input.endDate ? endOfISTDay(input.endDate) : campaign.endDate,
        dailyRentPaise: Math.round(rentPer30DaysPaise / 30),
        printingAllowancePaise,
        totalBudgetPaise: BigInt(preview.totalBudgetPaise),
        platformFeePaise: BigInt(preview.platformFeePaise),
        gstAmountPaise: BigInt(preview.gstAmountPaise),
        totalChargedPaise: BigInt(preview.totalChargedPaise),
        installApprover: input.installApprover ?? campaign.installApprover,
        printMaterial: input.printMaterial ?? campaign.printMaterial,
        printSize: input.printSize !== undefined ? input.printSize : campaign.printSize,
        printInstructions: input.printInstructions !== undefined ? input.printInstructions : campaign.printInstructions,
        posterFileId: input.posterFileId !== undefined ? input.posterFileId : campaign.posterFileId,
        enrolmentClosesAt: input.enrolmentClosesAt !== undefined ? (input.enrolmentClosesAt ? new Date(input.enrolmentClosesAt) : null) : campaign.enrolmentClosesAt,
        pricingSnapshot: preview as any,
      },
      include: {
        campaignZones: { include: { zone: true } },
        city: true,
      },
    });

    return this.mapToDto(updated);
  }

  /**
   * Submits a DRAFT campaign for Admin review with exhaustive validation.
   */
  static async submit(companyId: string, campaignId: string): Promise<CampaignDto> {
    const campaign = await prisma.campaign.findUnique({
      where: { id: campaignId },
      include: {
        campaignZones: { include: { zone: true } },
        posterFile: true,
        city: true,
      },
    });

    if (!campaign) {
      throw new AppError(ERROR_CODES.CAMPAIGN_NOT_FOUND, 404, 'Campaign not found');
    }

    if (campaign.companyId !== companyId) {
      throw new AppError(ERROR_CODES.FORBIDDEN, 403, 'You do not own this campaign');
    }

    if (campaign.status !== CAMPAIGN_STATUS.DRAFT) {
      throw new AppError(
        ERROR_CODES.CAMPAIGN_NOT_EDITABLE,
        400,
        `Only DRAFT campaigns can be submitted. Current status: ${campaign.status}`,
      );
    }

    // 1. Title & Description
    if (!campaign.title || campaign.title.trim().length < 3) {
      throw new AppError(ERROR_CODES.VALIDATION_ERROR, 400, 'Campaign title must be at least 3 characters');
    }

    // 2. Poster check
    if (!campaign.posterFileId || !campaign.posterFile || campaign.posterFile.status !== FILE_STATUS.CONFIRMED) {
      throw new AppError(ERROR_CODES.CAMPAIGN_POSTER_REQUIRED, 400, 'A confirmed poster upload is required to submit');
    }

    // 3. City check
    if (!campaign.cityId) {
      throw new AppError(ERROR_CODES.VALIDATION_ERROR, 400, 'Target city is required');
    }

    // 4. Zone checks (must belong to target city)
    for (const cz of campaign.campaignZones) {
      if (cz.zone.cityId !== campaign.cityId) {
        throw new AppError(
          ERROR_CODES.CAMPAIGN_ZONE_MISMATCH,
          400,
          `Zone "${cz.zone.name}" does not belong to the selected city`,
        );
      }
    }

    // 5. Settings validation
    const rules = await this.getRules();
    const today = todayIST();
    const startDateStr = toISTDate(campaign.startDate);
    const endDateStr = toISTDate(campaign.endDate);

    // Slots
    if (campaign.targetAutoCount < 1 || campaign.targetAutoCount > rules.maxSlots) {
      throw new AppError(
        ERROR_CODES.CAMPAIGN_SLOTS_OUT_OF_RANGE,
        400,
        `Auto slots must be between 1 and ${rules.maxSlots}`,
      );
    }

    // Lead days
    const minAllowedStartDate = addDaysIST(today, rules.minLeadDays);
    if (startDateStr < minAllowedStartDate) {
      throw new AppError(
        ERROR_CODES.START_DATE_TOO_SOON,
        400,
        `Start date must be at least ${rules.minLeadDays} days in advance (earliest allowed: ${minAllowedStartDate})`,
      );
    }

    // Duration days
    const duration = diffDaysIST(startDateStr, endDateStr);
    if (duration < rules.minCampaignDays || duration > rules.maxCampaignDays) {
      throw new AppError(
        ERROR_CODES.CAMPAIGN_DURATION_OUT_OF_RANGE,
        400,
        `Campaign duration (${duration} days) must be between ${rules.minCampaignDays} and ${rules.maxCampaignDays} days`,
      );
    }

    // Rent
    const rentPer30Days = campaign.dailyRentPaise * 30;
    if (rentPer30Days < rules.minRentPer30DaysPaise || rentPer30Days > rules.maxRentPer30DaysPaise) {
      throw new AppError(
        ERROR_CODES.CAMPAIGN_RENT_OUT_OF_RANGE,
        400,
        `Rent per 30 days (₹${rentPer30Days / 100}) must be between ₹${rules.minRentPer30DaysPaise / 100} and ₹${rules.maxRentPer30DaysPaise / 100}`,
      );
    }

    // Allowance
    if (campaign.printingAllowancePaise < 0 || campaign.printingAllowancePaise > rules.maxPrintingAllowancePaise) {
      throw new AppError(
        ERROR_CODES.CAMPAIGN_ALLOWANCE_OUT_OF_RANGE,
        400,
        `Printing allowance (₹${campaign.printingAllowancePaise / 100}) cannot exceed ₹${rules.maxPrintingAllowancePaise / 100}`,
      );
    }

    // Enrolment close default
    let enrolmentClosesAt = campaign.enrolmentClosesAt;
    if (!enrolmentClosesAt) {
      const closeDays = await SettingsService.get(SETTING_KEYS.ENROLMENT_CLOSE_DAYS_AFTER_START).catch(() => 3);
      const closeDateStr = addDaysIST(startDateStr, closeDays);
      enrolmentClosesAt = endOfISTDay(closeDateStr);
    }

    // Recalculate final pricing snapshot
    const pricingSnapshot = await this.calculatePricePreview({
      slots: campaign.targetAutoCount,
      rentPer30DaysPaise: rentPer30Days,
      printingAllowancePaise: campaign.printingAllowancePaise,
      startDate: startDateStr,
      endDate: endDateStr,
    });

    // State machine check
    await campaignStateMachine.assertTransition(CAMPAIGN_STATUS.DRAFT, CAMPAIGN_STATUS.SUBMITTED);

    const now = TimeService.now();
    const updated = await prisma.campaign.update({
      where: { id: campaign.id },
      data: {
        status: CAMPAIGN_STATUS.SUBMITTED,
        lastSubmittedAt: now,
        revisionCount: { increment: 1 },
        commissionBps: rules.commissionBps,
        gstBps: rules.gstBps,
        pricingSnapshot: pricingSnapshot as any,
        totalBudgetPaise: BigInt(pricingSnapshot.totalBudgetPaise),
        platformFeePaise: BigInt(pricingSnapshot.platformFeePaise),
        gstAmountPaise: BigInt(pricingSnapshot.gstAmountPaise),
        totalChargedPaise: BigInt(pricingSnapshot.totalChargedPaise),
        enrolmentClosesAt,
      },
      include: {
        campaignZones: { include: { zone: true } },
        city: true,
      },
    });

    await AuditService.log({
      actorId: companyId,
      actorType: ACTOR_TYPES.USER,
      action: 'campaign.submitted',
      entityType: 'Campaign',
      entityId: campaign.id,
      newValues: {
        status: CAMPAIGN_STATUS.SUBMITTED,
        revisionCount: updated.revisionCount,
        lastSubmittedAt: now.toISOString(),
      },
    });

    eventBus.emit('campaign.submitted', {
      campaignId: campaign.id,
      companyId: campaign.companyId,
      title: campaign.title,
      submittedAt: now,
    });

    return this.mapToDto(updated);
  }

  /**
   * Reopens a REJECTED campaign back to DRAFT for modifications.
   */
  static async reopen(companyId: string, campaignId: string): Promise<CampaignDto> {
    const campaign = await prisma.campaign.findUnique({
      where: { id: campaignId },
      include: { campaignZones: { include: { zone: true } }, city: true },
    });

    if (!campaign) {
      throw new AppError(ERROR_CODES.CAMPAIGN_NOT_FOUND, 404, 'Campaign not found');
    }

    if (campaign.companyId !== companyId) {
      throw new AppError(ERROR_CODES.FORBIDDEN, 403, 'You do not own this campaign');
    }

    if (campaign.status !== CAMPAIGN_STATUS.REJECTED) {
      throw new AppError(
        ERROR_CODES.INVALID_STATE_TRANSITION,
        400,
        `Only REJECTED campaigns can be reopened. Current status: ${campaign.status}`,
      );
    }

    await campaignStateMachine.assertTransition(CAMPAIGN_STATUS.REJECTED, CAMPAIGN_STATUS.DRAFT);

    const updated = await prisma.campaign.update({
      where: { id: campaignId },
      data: { status: CAMPAIGN_STATUS.DRAFT },
      include: { campaignZones: { include: { zone: true } }, city: true },
    });

    await AuditService.log({
      actorId: companyId,
      actorType: ACTOR_TYPES.USER,
      action: 'campaign.reopened',
      entityType: 'Campaign',
      entityId: campaignId,
      newValues: { status: CAMPAIGN_STATUS.DRAFT },
    });

    return this.mapToDto(updated);
  }

  /**
   * Cancels a campaign before payment.
   */
  static async cancel(
    companyId: string,
    campaignId: string,
    reason: string,
  ): Promise<CampaignDto> {
    const campaign = await prisma.campaign.findUnique({
      where: { id: campaignId },
      include: { campaignZones: { include: { zone: true } }, city: true },
    });

    if (!campaign) {
      throw new AppError(ERROR_CODES.CAMPAIGN_NOT_FOUND, 404, 'Campaign not found');
    }

    if (campaign.companyId !== companyId) {
      throw new AppError(ERROR_CODES.FORBIDDEN, 403, 'You do not own this campaign');
    }

    if (
      campaign.status === CAMPAIGN_STATUS.LIVE ||
      campaign.status === CAMPAIGN_STATUS.RUNNING
    ) {
      throw new AppError(
        ERROR_CODES.CAMPAIGN_CANCEL_NOT_AVAILABLE_YET,
        400,
        'Live or running campaigns cannot be cancelled online yet. Please contact support.',
      );
    }

    await campaignStateMachine.assertTransition(campaign.status, CAMPAIGN_STATUS.CANCELLED);

    const now = TimeService.now();
    const updated = await prisma.campaign.update({
      where: { id: campaignId },
      data: {
        status: CAMPAIGN_STATUS.CANCELLED,
        cancelledAt: now,
        cancellationReason: reason,
      },
      include: { campaignZones: { include: { zone: true } }, city: true },
    });

    await AuditService.log({
      actorId: companyId,
      actorType: ACTOR_TYPES.USER,
      action: 'campaign.cancelled',
      entityType: 'Campaign',
      entityId: campaignId,
      newValues: { status: CAMPAIGN_STATUS.CANCELLED, reason },
    });

    eventBus.emit('campaign.cancelled', {
      campaignId: campaign.id,
      companyId: campaign.companyId,
      title: campaign.title,
      cancelledAt: now,
      reason,
      cancelledBy: companyId,
    });

    return this.mapToDto(updated);
  }

  /**
   * Clones an existing campaign as a new DRAFT.
   */
  static async clone(companyId: string, campaignId: string): Promise<CampaignDto> {
    const source = await prisma.campaign.findUnique({
      where: { id: campaignId },
      include: { campaignZones: true },
    });

    if (!source) {
      throw new AppError(ERROR_CODES.CAMPAIGN_NOT_FOUND, 404, 'Source campaign not found');
    }

    if (source.companyId !== companyId) {
      throw new AppError(ERROR_CODES.FORBIDDEN, 403, 'You do not own this campaign');
    }

    const today = todayIST();
    const rules = await this.getRules();
    const newStartDate = addDaysIST(today, rules.minLeadDays + 1);
    const newEndDate = addDaysIST(newStartDate, 30);

    return this.createDraft(companyId, {
      title: `${source.title} (Clone)`,
      description: source.description,
      cityId: source.cityId ?? '',
      zoneIds: source.campaignZones.map((z) => z.zoneId),
      targetVehicleType: source.targetVehicleType as any,
      slots: source.targetAutoCount,
      startDate: newStartDate,
      endDate: newEndDate,
      rentPer30DaysPaise: source.dailyRentPaise * 30,
      printingAllowancePaise: source.printingAllowancePaise,
      posterFileId: source.posterFileId,
      printMaterial: source.printMaterial as any,
      printSize: source.printSize,
      printInstructions: source.printInstructions,
      installApprover: source.installApprover as any,
    });
  }

  /**
   * Lists campaigns for company with status counts.
   */
  static async list(companyId: string, query: ListCompanyCampaignsQuery) {
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.max(1, Math.min(100, query.pageSize ?? 20));
    const skip = (page - 1) * limit;

    const where: any = {
      companyId,
      deletedAt: null,
    };

    if (query.status) {
      where.status = query.status;
    }

    if (query.search) {
      where.title = { contains: query.search, mode: 'insensitive' };
    }

    const [items, total, countsRaw] = await Promise.all([
      prisma.campaign.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          campaignZones: { include: { zone: true } },
          city: true,
        },
      }),
      prisma.campaign.count({ where }),
      prisma.campaign.groupBy({
        by: ['status'],
        where: { companyId, deletedAt: null },
        _count: true,
      }),
    ]);

    const counts: Record<string, number> = {
      ALL: 0,
      DRAFT: 0,
      SUBMITTED: 0,
      UNDER_REVIEW: 0,
      APPROVED: 0,
      AWAITING_PAYMENT: 0,
      LIVE: 0,
      RUNNING: 0,
      COMPLETED: 0,
      SETTLED: 0,
      REJECTED: 0,
      EXPIRED: 0,
      CANCELLED: 0,
    };

    for (const c of countsRaw) {
      counts[c.status] = c._count;
      counts.ALL = (counts.ALL ?? 0) + c._count;
    }

    return {
      items: items.map((c) => this.mapToDto(c)),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      counts,
    };
  }

  /**
   * Retrieves full campaign details, review history, slot usage, and payment summary.
   */
  static async getDetail(companyId: string, campaignId: string): Promise<CampaignDetailDto> {
    const campaign = await prisma.campaign.findUnique({
      where: { id: campaignId },
      include: {
        campaignZones: { include: { zone: true } },
        city: true,
        company: {
          include: {
            companyProfile: true,
          },
        },
        reviews: {
          orderBy: { createdAt: 'desc' },
          include: { reviewer: true },
        },
      },
    });

    if (!campaign) {
      throw new AppError(ERROR_CODES.CAMPAIGN_NOT_FOUND, 404, 'Campaign not found');
    }

    if (campaign.companyId !== companyId) {
      throw new AppError(ERROR_CODES.FORBIDDEN, 403, 'You do not own this campaign');
    }

    const slotUsage = await SlotsService.getSlotUsage(campaignId);

    const isPayable = campaign.status === CAMPAIGN_STATUS.AWAITING_PAYMENT;
    let statusText = 'Pending Approval';
    if (campaign.status === CAMPAIGN_STATUS.AWAITING_PAYMENT) {
      statusText = 'Payment Required';
    } else if (campaign.status === CAMPAIGN_STATUS.LIVE) {
      statusText = 'Paid & Live';
    } else if (campaign.status === CAMPAIGN_STATUS.EXPIRED) {
      statusText = 'Payment Expired';
    }

    return {
      campaign: this.mapToDto(campaign),
      reviews: campaign.reviews.map((r) => ({
        id: r.id,
        campaignId: r.campaignId,
        attemptNo: r.attemptNo,
        reviewerId: r.reviewerId,
        reviewerName: r.reviewer.email ?? 'Reviewer',
        decision: r.decision as any,
        reasons: (r.reasons as any) ?? null,
        note: r.note,
        createdAt: r.createdAt.toISOString(),
      })),
      slotUsage,
      company: {
        id: campaign.company.id,
        businessName: campaign.company.companyProfile?.companyName ?? 'Company',
      },
      paymentSummary: {
        totalChargedPaise: campaign.totalChargedPaise.toString(),
        paymentDeadlineAt: campaign.paymentDeadlineAt?.toISOString() ?? null,
        isPayable,
        statusText,
      },
    };
  }

  /**
   * Soft-deletes a draft campaign.
   */
  static async deleteDraft(companyId: string, campaignId: string): Promise<void> {
    const campaign = await prisma.campaign.findUnique({
      where: { id: campaignId },
    });

    if (!campaign) {
      throw new AppError(ERROR_CODES.CAMPAIGN_NOT_FOUND, 404, 'Campaign not found');
    }

    if (campaign.companyId !== companyId) {
      throw new AppError(ERROR_CODES.FORBIDDEN, 403, 'You do not own this campaign');
    }

    if (campaign.status !== CAMPAIGN_STATUS.DRAFT) {
      throw new AppError(
        ERROR_CODES.CAMPAIGN_NOT_EDITABLE,
        400,
        'Only DRAFT campaigns can be deleted',
      );
    }

    await prisma.campaign.update({
      where: { id: campaignId },
      data: { deletedAt: new Date() },
    });
  }

  /**
   * Maps Prisma Campaign model to CampaignDto.
   */
  public static mapToDto(campaign: any): CampaignDto {
    const startDateStr = toISTDate(campaign.startDate);
    const endDateStr = toISTDate(campaign.endDate);
    const durationDays = diffDaysIST(startDateStr, endDateStr);

    return {
      id: campaign.id,
      companyId: campaign.companyId,
      title: campaign.title,
      description: campaign.description,
      posterFileId: campaign.posterFileId,
      targetVehicleType: campaign.targetVehicleType,
      cityId: campaign.cityId,
      cityName: campaign.city?.name ?? null,
      zoneIds: campaign.campaignZones?.map((cz: any) => cz.zoneId) ?? [],
      zoneNames: campaign.campaignZones?.map((cz: any) => cz.zone?.name).filter(Boolean) ?? [],
      slots: campaign.targetAutoCount,
      enrolledCount: campaign.enrolledCount,
      startDate: startDateStr,
      endDate: endDateStr,
      durationDays,
      rentPer30DaysPaise: campaign.dailyRentPaise * 30,
      dailyRentPaise: campaign.dailyRentPaise,
      printingAllowancePaise: campaign.printingAllowancePaise,
      totalBudgetPaise: campaign.totalBudgetPaise.toString(),
      platformFeePaise: campaign.platformFeePaise.toString(),
      gstAmountPaise: campaign.gstAmountPaise.toString(),
      totalChargedPaise: campaign.totalChargedPaise.toString(),
      status: campaign.status,
      installApprover: campaign.installApprover,
      printMaterial: campaign.printMaterial,
      printSize: campaign.printSize,
      enrolmentClosesAt: campaign.enrolmentClosesAt?.toISOString() ?? null,
      paymentDeadlineAt: campaign.paymentDeadlineAt?.toISOString() ?? null,
      liveAt: campaign.liveAt?.toISOString() ?? null,
      assignedToId: campaign.assignedToId,
      assignedAt: campaign.assignedAt?.toISOString() ?? null,
      revisionCount: campaign.revisionCount,
      reviewReasons: campaign.reviewReasons as any,
      lastSubmittedAt: campaign.lastSubmittedAt?.toISOString() ?? null,
      createdAt: campaign.createdAt.toISOString(),
      updatedAt: campaign.updatedAt.toISOString(),
      pricingSnapshot: campaign.pricingSnapshot as any,
    };
  }
}
