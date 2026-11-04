import { prisma } from '../../shared/db/index.js';
import {
  CAMPAIGN_STATUS,
  CAMPAIGN_REVIEW_DECISIONS,
  CAMPAIGN_REVIEW_REASONS,
  ACTOR_TYPES,
  ERROR_CODES,
  ROLES,
  SETTING_KEYS,
  type Role,
  type CampaignStatus,
} from '@ap/shared-constants';
import { AppError } from '../../shared/errors/index.js';
import { campaignStateMachine } from './campaigns.state-machine.js';
import { CompanyCampaignsService } from './company-campaigns.service.js';
import { FileAccessService } from '../uploads/uploads.service.js';
import { SlotsService } from './slots.service.js';
import { SettingsService } from '../settings/settings.service.js';
import { AuditService } from '../audit/audit.service.js';
import { eventBus } from '../../events/index.js';
import {
  todayIST,
  toISTDate,
  addDaysIST,
  diffDaysIST,
  TimeService,
} from '../../shared/time/index.js';
import type {
  ListAdminCampaignsQuery,
  AdminCampaignDecisionInput,
} from '@ap/shared-validation';
import type { CampaignDto, CampaignReviewDto } from '@ap/shared-types';

export class AdminCampaignsService {
  /**
   * Lists campaigns across the platform with filters. Guarded by campaign.view.
   */
  static async list(query: ListAdminCampaignsQuery) {
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.max(1, Math.min(100, query.pageSize ?? 20));
    const skip = (page - 1) * limit;

    const where: any = {
      deletedAt: null,
    };

    if (query.status) {
      where.status = query.status;
    }
    if (query.cityId) {
      where.cityId = query.cityId;
    }
    if (query.companyId) {
      where.companyId = query.companyId;
    }
    if (query.search) {
      where.title = { contains: query.search, mode: 'insensitive' };
    }
    if (query.startDateFrom) {
      where.startDate = { gte: new Date(`${query.startDateFrom}T00:00:00.000Z`) };
    }
    if (query.startDateTo) {
      where.startDate = { ...where.startDate, lte: new Date(`${query.startDateTo}T23:59:59.999Z`) };
    }

    const [items, total] = await Promise.all([
      prisma.campaign.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          campaignZones: { include: { zone: true } },
          city: true,
          company: { include: { companyProfile: true } },
          assignedTo: true,
        },
      }),
      prisma.campaign.count({ where }),
    ]);

    return {
      items: items.map((c) => ({
        ...CompanyCampaignsService.mapToDto(c),
        companyName: c.company.companyProfile?.companyName ?? 'Company',
        assignedToName: c.assignedTo?.email ?? null,
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Review queue: returns SUBMITTED and UNDER_REVIEW items, oldest first,
   * with calculated waiting times and SLA breach flags.
   */
  static async getReviewQueue(
    reviewerId: string,
    options: { assignedToMe?: boolean; unassigned?: boolean } = {},
  ) {
    let slaHours = 24;
    try {
      slaHours = await SettingsService.get(SETTING_KEYS.CAMPAIGN_REVIEW_SLA_HOURS);
    } catch {
      slaHours = 24;
    }

    const where: any = {
      deletedAt: null,
      status: { in: [CAMPAIGN_STATUS.SUBMITTED, CAMPAIGN_STATUS.UNDER_REVIEW] },
    };

    if (options.assignedToMe) {
      where.assignedToId = reviewerId;
    } else if (options.unassigned) {
      where.assignedToId = null;
    }

    const campaigns = await prisma.campaign.findMany({
      where,
      orderBy: { lastSubmittedAt: 'asc' },
      include: {
        city: true,
        company: { include: { companyProfile: true } },
        assignedTo: true,
      },
    });

    const now = TimeService.now().getTime();
    return campaigns.map((c) => {
      const submittedAt = c.lastSubmittedAt ?? c.createdAt;
      const waitingTimeMinutes = Math.max(0, Math.floor((now - submittedAt.getTime()) / (60 * 1000)));
      const isSlaBreached = waitingTimeMinutes > slaHours * 60;

      return {
        id: c.id,
        title: c.title,
        status: c.status,
        companyId: c.companyId,
        companyName: c.company.companyProfile?.companyName ?? 'Company',
        cityName: c.city?.name ?? null,
        slots: c.targetAutoCount,
        rentPer30DaysPaise: c.dailyRentPaise * 30,
        submittedAt: submittedAt.toISOString(),
        waitingTimeMinutes,
        isSlaBreached,
        assignedToId: c.assignedToId,
        assignedToName: c.assignedTo?.email ?? null,
        assignedAt: c.assignedAt?.toISOString() ?? null,
      };
    });
  }

  /**
   * Atomically claims the next unassigned SUBMITTED campaign (FIFO).
   */
  static async claimNext(reviewerId: string): Promise<CampaignDto> {
    const result = await prisma.$transaction(async (tx) => {
      // Find oldest unassigned submitted campaign
      const nextCampaign = await tx.campaign.findFirst({
        where: {
          status: CAMPAIGN_STATUS.SUBMITTED,
          assignedToId: null,
          deletedAt: null,
        },
        orderBy: { lastSubmittedAt: 'asc' },
      });

      if (!nextCampaign) {
        throw new AppError(ERROR_CODES.NOT_FOUND, 404, 'No unassigned campaigns in review queue');
      }

      // Check transition
      await campaignStateMachine.assertTransition(CAMPAIGN_STATUS.SUBMITTED, CAMPAIGN_STATUS.UNDER_REVIEW);

      const now = TimeService.now();
      const updated = await tx.campaign.update({
        where: { id: nextCampaign.id },
        data: {
          assignedToId: reviewerId,
          assignedAt: now,
          status: CAMPAIGN_STATUS.UNDER_REVIEW,
        },
        include: {
          campaignZones: { include: { zone: true } },
          city: true,
        },
      });

      return updated;
    });

    await AuditService.log({
      actorId: reviewerId,
      actorType: ACTOR_TYPES.USER,
      action: 'campaign.claimed',
      entityType: 'Campaign',
      entityId: result.id,
      newValues: { assignedToId: reviewerId, status: CAMPAIGN_STATUS.UNDER_REVIEW },
    });

    return CompanyCampaignsService.mapToDto(result);
  }

  /**
   * Claims a specific campaign for review.
   */
  static async claim(reviewerId: string, campaignId: string): Promise<CampaignDto> {
    const campaign = await prisma.campaign.findUnique({
      where: { id: campaignId },
    });

    if (!campaign) {
      throw new AppError(ERROR_CODES.CAMPAIGN_NOT_FOUND, 404, 'Campaign not found');
    }

    if (campaign.assignedToId && campaign.assignedToId !== reviewerId) {
      throw new AppError(
        ERROR_CODES.CAMPAIGN_ALREADY_CLAIMED,
        409,
        'This campaign is already claimed by another reviewer',
      );
    }

    if (campaign.status === CAMPAIGN_STATUS.SUBMITTED) {
      await campaignStateMachine.assertTransition(CAMPAIGN_STATUS.SUBMITTED, CAMPAIGN_STATUS.UNDER_REVIEW);
    }

    const now = TimeService.now();
    const updated = await prisma.campaign.update({
      where: { id: campaignId },
      data: {
        assignedToId: reviewerId,
        assignedAt: now,
        status: CAMPAIGN_STATUS.UNDER_REVIEW,
      },
      include: {
        campaignZones: { include: { zone: true } },
        city: true,
      },
    });

    await AuditService.log({
      actorId: reviewerId,
      actorType: ACTOR_TYPES.USER,
      action: 'campaign.claimed',
      entityType: 'Campaign',
      entityId: campaignId,
      newValues: { assignedToId: reviewerId, status: CAMPAIGN_STATUS.UNDER_REVIEW },
    });

    return CompanyCampaignsService.mapToDto(updated);
  }

  /**
   * Releases a claimed campaign back to the pool.
   */
  static async release(reviewerId: string, campaignId: string, role: Role): Promise<CampaignDto> {
    const campaign = await prisma.campaign.findUnique({
      where: { id: campaignId },
    });

    if (!campaign) {
      throw new AppError(ERROR_CODES.CAMPAIGN_NOT_FOUND, 404, 'Campaign not found');
    }

    if (campaign.assignedToId !== reviewerId && role !== ROLES.SUPER_ADMIN) {
      throw new AppError(ERROR_CODES.FORBIDDEN, 403, 'You can only release campaigns assigned to you');
    }

    if (campaign.status === CAMPAIGN_STATUS.UNDER_REVIEW) {
      // Revert status to SUBMITTED
      await prisma.campaign.update({
        where: { id: campaignId },
        data: {
          assignedToId: null,
          assignedAt: null,
          status: CAMPAIGN_STATUS.SUBMITTED,
        },
      });
    } else {
      await prisma.campaign.update({
        where: { id: campaignId },
        data: {
          assignedToId: null,
          assignedAt: null,
        },
      });
    }

    const updated = await prisma.campaign.findUniqueOrThrow({
      where: { id: campaignId },
      include: {
        campaignZones: { include: { zone: true } },
        city: true,
      },
    });

    await AuditService.log({
      actorId: reviewerId,
      actorType: ACTOR_TYPES.USER,
      action: 'campaign.released',
      entityType: 'Campaign',
      entityId: campaignId,
    });

    return CompanyCampaignsService.mapToDto(updated);
  }

  /**
   * Retrieves full admin campaign review details including signed poster URLs,
   * audit log trigger, server-computed pricing check, and automated review warnings.
   */
  static async getDetail(reviewer: { id: string; role: Role; permissions: string[] }, campaignId: string) {
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
        posterFile: true,
      },
    });

    if (!campaign) {
      throw new AppError(ERROR_CODES.CAMPAIGN_NOT_FOUND, 404, 'Campaign not found');
    }

    // Generate signed URLs for poster (original, preview, thumbnail) through FileAccessService (audited!)
    let posterUrls: { original?: string; preview?: string; thumbnail?: string } = {};
    if (campaign.posterFileId) {
      const [orig, prev, thumb] = await Promise.all([
        FileAccessService.getSignedUrl(campaign.posterFileId, reviewer, { variant: 'original', reason: 'ADMIN_CAMPAIGN_REVIEW' }).catch(() => null),
        FileAccessService.getSignedUrl(campaign.posterFileId, reviewer, { variant: 'preview', reason: 'ADMIN_CAMPAIGN_REVIEW' }).catch(() => null),
        FileAccessService.getSignedUrl(campaign.posterFileId, reviewer, { variant: 'thumbnail', reason: 'ADMIN_CAMPAIGN_REVIEW' }).catch(() => null),
      ]);
      posterUrls = {
        original: orig?.url,
        preview: prev?.url,
        thumbnail: thumb?.url,
      };
    }

    // Warnings calculation
    const warnings: string[] = [];
    const rules = await CompanyCampaignsService.getRules();
    const rentPer30Days = campaign.dailyRentPaise * 30;

    // Price near minimum (< 10% above min)
    if (rentPer30Days <= rules.minRentPer30DaysPaise * 1.1) {
      warnings.push('OFFERED_RENT_NEAR_MINIMUM: Rent is very close to platform minimum.');
    }

    // Start date very close (< minLeadDays + 2)
    const startDateStr = toISTDate(campaign.startDate);
    const leadDays = diffDaysIST(todayIST(), startDateStr);
    if (leadDays <= rules.minLeadDays + 2) {
      warnings.push(`START_DATE_VERY_CLOSE: Campaign starts in ${leadDays} days, leaving tight printing window.`);
    }

    // Very large slot count versus available drivers
    const availability = await CompanyCampaignsService.getAvailability(
      campaign.cityId ?? '',
      campaign.campaignZones.map((z) => z.zoneId),
      campaign.targetVehicleType,
    );
    if (campaign.targetAutoCount > availability.count) {
      warnings.push(
        `SLOTS_EXCEED_CURRENT_SUPPLY: Requested ${campaign.targetAutoCount} slots, but only ${availability.count} eligible drivers currently available.`,
      );
    }

    const slotUsage = await SlotsService.getSlotUsage(campaignId);

    return {
      campaign: {
        ...CompanyCampaignsService.mapToDto(campaign),
        posterUrl: posterUrls.original ?? null,
        posterPreviewUrl: posterUrls.preview ?? null,
        posterThumbnailUrl: posterUrls.thumbnail ?? null,
      },
      company: {
        id: campaign.company.id,
        businessName: campaign.company.companyProfile?.companyName ?? 'Company',
        kycApprovedAt: campaign.company.companyProfile?.createdAt.toISOString() ?? null,
        gstin: campaign.company.companyProfile?.gstin ?? null,
      },
      warnings,
      slotUsage,
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
    };
  }

  /**
   * Admin decision: APPROVE or REJECT.
   */
  static async decide(
    reviewerId: string,
    campaignId: string,
    role: Role,
    input: AdminCampaignDecisionInput,
  ): Promise<CampaignDto> {
    const campaign = await prisma.campaign.findUnique({
      where: { id: campaignId },
      include: { company: true },
    });

    if (!campaign) {
      throw new AppError(ERROR_CODES.CAMPAIGN_NOT_FOUND, 404, 'Campaign not found');
    }

    // Authorization: must be assigned reviewer or Super Admin
    if (campaign.assignedToId !== reviewerId && role !== ROLES.SUPER_ADMIN) {
      throw new AppError(
        ERROR_CODES.FORBIDDEN,
        403,
        'You can only make a decision on campaigns assigned to you',
      );
    }

    if (
      campaign.status !== CAMPAIGN_STATUS.SUBMITTED &&
      campaign.status !== CAMPAIGN_STATUS.UNDER_REVIEW
    ) {
      throw new AppError(
        ERROR_CODES.INVALID_STATE_TRANSITION,
        400,
        `Cannot decide on campaign with status ${campaign.status}`,
      );
    }

    const now = TimeService.now();
    const attemptNo = campaign.revisionCount || 1;

    if (input.decision === CAMPAIGN_REVIEW_DECISIONS.APPROVED) {
      // 1. Calculate payment deadline: min(now + payment_deadline_days, startDate - min_payment_lead_days)
      const paymentDeadlineDays = await SettingsService.get(
        SETTING_KEYS.PAYMENT_DEADLINE_DAYS,
      ).catch(() => 7);
      const minPaymentLeadDays = await SettingsService.get(
        SETTING_KEYS.MIN_PAYMENT_LEAD_DAYS,
      ).catch(() => 1);

      const deadlineByDays = new Date(now.getTime() + paymentDeadlineDays * 24 * 60 * 60 * 1000);
      const deadlineByLead = new Date(campaign.startDate.getTime() - minPaymentLeadDays * 24 * 60 * 60 * 1000);

      const paymentDeadlineAt = deadlineByDays < deadlineByLead ? deadlineByDays : deadlineByLead;

      // Check if payment deadline is in the future
      if (paymentDeadlineAt <= now) {
        throw new AppError(
          ERROR_CODES.START_DATE_TOO_SOON,
          400,
          'Campaign start date is too soon to allow payment deadline. Please reject with START_DATE_TOO_SOON so company can update dates.',
        );
      }

      // Transition: UNDER_REVIEW -> APPROVED -> AWAITING_PAYMENT in same transaction
      if (campaign.status === CAMPAIGN_STATUS.SUBMITTED) {
        await campaignStateMachine.assertTransition(CAMPAIGN_STATUS.SUBMITTED, CAMPAIGN_STATUS.UNDER_REVIEW);
      }
      await campaignStateMachine.assertTransition(CAMPAIGN_STATUS.UNDER_REVIEW, CAMPAIGN_STATUS.APPROVED);
      await campaignStateMachine.assertTransition(CAMPAIGN_STATUS.APPROVED, CAMPAIGN_STATUS.AWAITING_PAYMENT);

      const result = await prisma.$transaction(async (tx) => {
        // Create review record
        await tx.campaignReview.create({
          data: {
            campaignId: campaign.id,
            attemptNo,
            reviewerId,
            decision: CAMPAIGN_REVIEW_DECISIONS.APPROVED,
            note: input.note,
          },
        });

        // Update campaign
        return tx.campaign.update({
          where: { id: campaign.id },
          data: {
            status: CAMPAIGN_STATUS.AWAITING_PAYMENT,
            approvedAt: now,
            approvedByUserId: reviewerId,
            paymentDeadlineAt,
          },
          include: {
            campaignZones: { include: { zone: true } },
            city: true,
          },
        });
      });

      await AuditService.log({
        actorId: reviewerId,
        actorType: ACTOR_TYPES.USER,
        action: 'campaign.approved',
        entityType: 'Campaign',
        entityId: campaign.id,
        newValues: {
          status: CAMPAIGN_STATUS.AWAITING_PAYMENT,
          paymentDeadlineAt: paymentDeadlineAt.toISOString(),
          decision: 'APPROVED',
        },
      });

      eventBus.emit('campaign.approved', {
        campaignId: campaign.id,
        companyId: campaign.companyId,
        title: campaign.title,
        approvedAt: now,
        paymentDeadlineAt,
        totalChargedPaise: campaign.totalChargedPaise,
      });

      return CompanyCampaignsService.mapToDto(result);
    } else {
      // REJECTED
      if (!input.reasons || input.reasons.length === 0) {
        throw new AppError(
          ERROR_CODES.REASON_REQUIRED,
          400,
          'At least one rejection reason code is required',
        );
      }

      if (campaign.status === CAMPAIGN_STATUS.SUBMITTED) {
        await campaignStateMachine.assertTransition(CAMPAIGN_STATUS.SUBMITTED, CAMPAIGN_STATUS.UNDER_REVIEW);
      }
      await campaignStateMachine.assertTransition(CAMPAIGN_STATUS.UNDER_REVIEW, CAMPAIGN_STATUS.REJECTED);

      const result = await prisma.$transaction(async (tx) => {
        await tx.campaignReview.create({
          data: {
            campaignId: campaign.id,
            attemptNo,
            reviewerId,
            decision: CAMPAIGN_REVIEW_DECISIONS.REJECTED,
            reasons: input.reasons as any,
            note: input.note,
          },
        });

        return tx.campaign.update({
          where: { id: campaign.id },
          data: {
            status: CAMPAIGN_STATUS.REJECTED,
            reviewReasons: input.reasons as any,
          },
          include: {
            campaignZones: { include: { zone: true } },
            city: true,
          },
        });
      });

      await AuditService.log({
        actorId: reviewerId,
        actorType: ACTOR_TYPES.USER,
        action: 'campaign.rejected',
        entityType: 'Campaign',
        entityId: campaign.id,
        newValues: {
          status: CAMPAIGN_STATUS.REJECTED,
          reasons: input.reasons,
          decision: 'REJECTED',
        },
      });

      eventBus.emit('campaign.rejected', {
        campaignId: campaign.id,
        companyId: campaign.companyId,
        title: campaign.title,
        rejectedAt: now,
        reasons: input.reasons,
        note: input.note,
      });

      return CompanyCampaignsService.mapToDto(result);
    }
  }

  /**
   * Super Admin force cancellation prior to payment.
   */
  static async forceCancel(adminId: string, campaignId: string, reason: string): Promise<CampaignDto> {
    const campaign = await prisma.campaign.findUnique({
      where: { id: campaignId },
    });

    if (!campaign) {
      throw new AppError(ERROR_CODES.CAMPAIGN_NOT_FOUND, 404, 'Campaign not found');
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
      include: {
        campaignZones: { include: { zone: true } },
        city: true,
      },
    });

    await AuditService.log({
      actorId: adminId,
      actorType: ACTOR_TYPES.USER,
      action: 'campaign.cancelled',
      entityType: 'Campaign',
      entityId: campaignId,
      newValues: { status: CAMPAIGN_STATUS.CANCELLED, reason, forcedByAdmin: true },
    });

    eventBus.emit('campaign.cancelled', {
      campaignId: campaign.id,
      companyId: campaign.companyId,
      title: campaign.title,
      cancelledAt: now,
      reason,
      cancelledBy: adminId,
    });

    return CompanyCampaignsService.mapToDto(updated);
  }
}
