import {
  ROLES,
  KYC_SUBMISSION_STATUS,
  CAMPAIGN_STATUS,
  ASSIGNMENT_STATUS,
  PHOTO_FLAG_STATUSES,
  REFUND_STATUS,
  SETTLEMENT_STATUS,
  ADJUSTMENT_STATUS,
  ACTOR_TYPES,
} from '@ap/shared-constants';
import { prisma } from '../../../shared/db/index.js';
import { AuditService } from '../../audit/audit.service.js';
import { NotFoundError, ValidationError } from '../../../shared/errors/index.js';

export interface QueueSummaryItem {
  key: string;
  name: string;
  count: number;
  oldestCreatedAt: string | null;
  slaBreachedCount: number;
  myAssignedCount: number;
}

export interface MyWorkItem {
  id: string;
  queue: string;
  title: string;
  subtitle: string;
  priority: 'CRITICAL' | 'HIGH' | 'NORMAL' | 'LOW';
  status: string;
  createdAt: string;
  slaDueAt: string | null;
  link: string;
}

export interface TeamWorkloadMember {
  adminId: string;
  fullName: string | null;
  email: string | null;
  role: string;
  assignedCount: number;
  completedTodayCount: number;
  queuesBreakdown: Record<string, number>;
}

export class WorkQueuesService {
  /**
   * Summarizes pending item counts and SLA status across all queues.
   */
  static async getSummary(adminId?: string): Promise<{ queues: QueueSummaryItem[]; totalPending: number }> {
    const now = new Date();
    const h24Ago = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const h48Ago = new Date(now.getTime() - 48 * 60 * 60 * 1000);
    const h72Ago = new Date(now.getTime() - 72 * 60 * 60 * 1000);

    const [
      kycCount,
      kycOldest,
      kycBreached,
      kycMy,
      campaignCount,
      campaignOldest,
      campaignBreached,
      campaignMy,
      installCount,
      installOldest,
      installBreached,
      installMy,
      dailyPhotoCount,
      dailyPhotoOldest,
      dailyPhotoBreached,
      dailyPhotoMy,
      flagCount,
      flagOldest,
      disputeCount,
      disputeOldest,
      disputeBreached,
      disputeMy,
      refundCount,
      refundOldest,
      settlementCount,
      settlementOldest,
      adjCount,
      adjOldest,
      settingsCount,
      settingsOldest,
    ] = await Promise.all([
      // 1. KYC
      prisma.kycSubmission.count({ where: { status: KYC_SUBMISSION_STATUS.SUBMITTED } }),
      prisma.kycSubmission.findFirst({
        where: { status: KYC_SUBMISSION_STATUS.SUBMITTED },
        orderBy: { submittedAt: 'asc' },
        select: { submittedAt: true },
      }),
      prisma.kycSubmission.count({
        where: { status: KYC_SUBMISSION_STATUS.SUBMITTED, submittedAt: { lt: h24Ago } },
      }),
      adminId
        ? prisma.kycSubmission.count({
            where: { status: KYC_SUBMISSION_STATUS.SUBMITTED, assignedToId: adminId },
          })
        : 0,

      // 2. Campaigns
      prisma.campaign.count({ where: { status: CAMPAIGN_STATUS.SUBMITTED } }),
      prisma.campaign.findFirst({
        where: { status: CAMPAIGN_STATUS.SUBMITTED },
        orderBy: { createdAt: 'asc' },
        select: { createdAt: true },
      }),
      prisma.campaign.count({
        where: { status: CAMPAIGN_STATUS.SUBMITTED, createdAt: { lt: h48Ago } },
      }),
      adminId
        ? prisma.campaign.count({
            where: { status: CAMPAIGN_STATUS.SUBMITTED, assignedToId: adminId },
          })
        : 0,

      // 3. Installations
      prisma.assignment.count({ where: { status: ASSIGNMENT_STATUS.INSTALL_SUBMITTED } }),
      prisma.assignment.findFirst({
        where: { status: ASSIGNMENT_STATUS.INSTALL_SUBMITTED },
        orderBy: { updatedAt: 'asc' },
        select: { updatedAt: true },
      }),
      prisma.assignment.count({
        where: { status: ASSIGNMENT_STATUS.INSTALL_SUBMITTED, updatedAt: { lt: h24Ago } },
      }),
      adminId
        ? prisma.assignment.count({
            where: { status: ASSIGNMENT_STATUS.INSTALL_SUBMITTED, reviewClaimedById: adminId },
          })
        : 0,

      // 4. Daily Photos (Manual Review)
      prisma.photo.count({ where: { kind: 'DAILY', status: 'MANUAL_REVIEW' } }),
      prisma.photo.findFirst({
        where: { kind: 'DAILY', status: 'MANUAL_REVIEW' },
        orderBy: { uploadedAt: 'asc' },
        select: { uploadedAt: true },
      }),
      prisma.photo.count({
        where: { kind: 'DAILY', status: 'MANUAL_REVIEW', uploadedAt: { lt: h24Ago } },
      }),
      adminId
        ? prisma.photo.count({
            where: { kind: 'DAILY', status: 'MANUAL_REVIEW', reviewClaimedById: adminId },
          })
        : 0,

      // 5. Photo Flags
      prisma.photoFlag.count({ where: { status: PHOTO_FLAG_STATUSES.OPEN } }),
      prisma.photoFlag.findFirst({
        where: { status: PHOTO_FLAG_STATUSES.OPEN },
        orderBy: { createdAt: 'asc' },
        select: { createdAt: true },
      }),

      // 6. Disputes
      prisma.dispute.count({ where: { status: { in: ['OPEN', 'UNDER_REVIEW'] } } }),
      prisma.dispute.findFirst({
        where: { status: { in: ['OPEN', 'UNDER_REVIEW'] } },
        orderBy: { createdAt: 'asc' },
        select: { createdAt: true },
      }),
      prisma.dispute.count({
        where: { status: { in: ['OPEN', 'UNDER_REVIEW'] }, slaDueAt: { lt: now } },
      }),
      adminId
        ? prisma.dispute.count({
            where: { status: { in: ['OPEN', 'UNDER_REVIEW'] }, assignedToId: adminId },
          })
        : 0,

      // 7. Refunds
      prisma.refund.count({ where: { status: REFUND_STATUS.PENDING } }),
      prisma.refund.findFirst({
        where: { status: REFUND_STATUS.PENDING },
        orderBy: { createdAt: 'asc' },
        select: { createdAt: true },
      }),

      // 8. Settlements
      prisma.assignmentSettlement.count({ where: { status: SETTLEMENT_STATUS.PENDING } }),
      prisma.assignmentSettlement.findFirst({
        where: { status: SETTLEMENT_STATUS.PENDING },
        orderBy: { createdAt: 'asc' },
        select: { createdAt: true },
      }),

      // 9. Ledger Adjustments
      prisma.adjustment.count({ where: { status: ADJUSTMENT_STATUS.PENDING } }),
      prisma.adjustment.findFirst({
        where: { status: ADJUSTMENT_STATUS.PENDING },
        orderBy: { createdAt: 'asc' },
        select: { createdAt: true },
      }),

      // 10. Setting Changes
      prisma.settingChangeRequest.count({ where: { status: 'REQUESTED' } }),
      prisma.settingChangeRequest.findFirst({
        where: { status: 'REQUESTED' },
        orderBy: { createdAt: 'asc' },
        select: { createdAt: true },
      }),
    ]);

    const queues: QueueSummaryItem[] = [
      {
        key: 'kyc',
        name: 'Driver & Company KYC',
        count: kycCount,
        oldestCreatedAt: kycOldest?.submittedAt ? kycOldest.submittedAt.toISOString() : null,
        slaBreachedCount: kycBreached,
        myAssignedCount: kycMy,
      },
      {
        key: 'campaigns',
        name: 'Campaign Approvals',
        count: campaignCount,
        oldestCreatedAt: campaignOldest?.createdAt ? campaignOldest.createdAt.toISOString() : null,
        slaBreachedCount: campaignBreached,
        myAssignedCount: campaignMy,
      },
      {
        key: 'installations',
        name: 'Installation Photos',
        count: installCount,
        oldestCreatedAt: installOldest?.updatedAt ? installOldest.updatedAt.toISOString() : null,
        slaBreachedCount: installBreached,
        myAssignedCount: installMy,
      },
      {
        key: 'daily_photos',
        name: 'Daily Photo Proofs',
        count: dailyPhotoCount,
        oldestCreatedAt: dailyPhotoOldest?.uploadedAt ? dailyPhotoOldest.uploadedAt.toISOString() : null,
        slaBreachedCount: dailyPhotoBreached,
        myAssignedCount: dailyPhotoMy,
      },
      {
        key: 'photo_flags',
        name: 'Company Photo Flags',
        count: flagCount,
        oldestCreatedAt: flagOldest?.createdAt ? flagOldest.createdAt.toISOString() : null,
        slaBreachedCount: 0,
        myAssignedCount: 0,
      },
      {
        key: 'disputes',
        name: 'Disputes & Appeals',
        count: disputeCount,
        oldestCreatedAt: disputeOldest?.createdAt ? disputeOldest.createdAt.toISOString() : null,
        slaBreachedCount: disputeBreached,
        myAssignedCount: disputeMy,
      },
      {
        key: 'refunds',
        name: 'Refund Requests',
        count: refundCount,
        oldestCreatedAt: refundOldest?.createdAt ? refundOldest.createdAt.toISOString() : null,
        slaBreachedCount: 0,
        myAssignedCount: 0,
      },
      {
        key: 'settlements',
        name: 'Campaign Settlements',
        count: settlementCount,
        oldestCreatedAt: settlementOldest?.createdAt ? settlementOldest.createdAt.toISOString() : null,
        slaBreachedCount: 0,
        myAssignedCount: 0,
      },
      {
        key: 'adjustments',
        name: 'Ledger Adjustments',
        count: adjCount,
        oldestCreatedAt: adjOldest?.createdAt ? adjOldest.createdAt.toISOString() : null,
        slaBreachedCount: 0,
        myAssignedCount: 0,
      },
      {
        key: 'settings',
        name: 'Setting Change Requests',
        count: settingsCount,
        oldestCreatedAt: settingsOldest?.createdAt ? settingsOldest.createdAt.toISOString() : null,
        slaBreachedCount: 0,
        myAssignedCount: 0,
      },
    ];

    const totalPending = queues.reduce((sum, q) => sum + q.count, 0);

    return { queues, totalPending };
  }

  /**
   * Retrieves work items currently claimed by or assigned to the requesting administrator.
   */
  static async getMyWork(adminId: string): Promise<MyWorkItem[]> {
    const items: MyWorkItem[] = [];

    // 1. KYC assigned
    const kyc = await prisma.kycSubmission.findMany({
      where: { assignedToId: adminId, status: KYC_SUBMISSION_STATUS.SUBMITTED },
      include: { user: { include: { driverProfile: true, companyProfile: true } } },
      orderBy: { submittedAt: 'asc' },
      take: 25,
    });
    for (const sub of kyc) {
      const name =
        sub.user.driverProfile?.fullName ||
        sub.user.companyProfile?.companyName ||
        sub.user.mobile ||
        'User KYC';
      items.push({
        id: sub.id,
        queue: 'kyc',
        title: `KYC Review: ${name}`,
        subtitle: `Attempt #${sub.attemptNo} - ${sub.user.role}`,
        priority: 'HIGH',
        status: sub.status,
        createdAt: sub.submittedAt.toISOString(),
        slaDueAt: new Date(sub.submittedAt.getTime() + 24 * 60 * 60 * 1000).toISOString(),
        link: `/admin/kyc?id=${sub.id}`,
      });
    }

    // 2. Campaigns assigned
    const campaigns = await prisma.campaign.findMany({
      where: { assignedToId: adminId, status: CAMPAIGN_STATUS.SUBMITTED },
      include: { company: { include: { companyProfile: true } } },
      orderBy: { createdAt: 'asc' },
      take: 25,
    });
    for (const c of campaigns) {
      items.push({
        id: c.id,
        queue: 'campaigns',
        title: `Campaign Review: ${c.title}`,
        subtitle: `${c.company.companyProfile?.companyName || 'Company'} (${c.targetAutoCount} slots)`,
        priority: 'HIGH',
        status: c.status,
        createdAt: c.createdAt.toISOString(),
        slaDueAt: new Date(c.createdAt.getTime() + 48 * 60 * 60 * 1000).toISOString(),
        link: `/admin/campaigns?id=${c.id}`,
      });
    }

    // 3. Installations claimed
    const installations = await prisma.assignment.findMany({
      where: { reviewClaimedById: adminId, status: ASSIGNMENT_STATUS.INSTALL_SUBMITTED },
      include: { campaign: true, driver: { include: { driverProfile: true } } },
      orderBy: { updatedAt: 'asc' },
      take: 25,
    });
    for (const inst of installations) {
      items.push({
        id: inst.id,
        queue: 'installations',
        title: `Installation: ${inst.campaign.title}`,
        subtitle: `Driver: ${inst.driver.driverProfile?.fullName || 'Driver'}`,
        priority: 'NORMAL',
        status: inst.status,
        createdAt: inst.updatedAt.toISOString(),
        slaDueAt: new Date(inst.updatedAt.getTime() + 24 * 60 * 60 * 1000).toISOString(),
        link: `/admin/installations?id=${inst.id}`,
      });
    }

    // 4. Disputes assigned
    const disputes = await prisma.dispute.findMany({
      where: { assignedToId: adminId, status: { in: ['OPEN', 'UNDER_REVIEW'] } },
      orderBy: { createdAt: 'asc' },
      take: 25,
    });
    for (const disp of disputes) {
      items.push({
        id: disp.id,
        queue: 'disputes',
        title: `Dispute #${disp.id.slice(0, 8)}`,
        subtitle: disp.reason,
        priority: disp.slaDueAt && disp.slaDueAt < new Date() ? 'CRITICAL' : 'HIGH',
        status: disp.status,
        createdAt: disp.createdAt.toISOString(),
        slaDueAt: disp.slaDueAt ? disp.slaDueAt.toISOString() : null,
        link: `/admin/disputes/${disp.id}`,
      });
    }

    // 5. Daily Photos claimed
    const dailyPhotos = await prisma.photo.findMany({
      where: { reviewClaimedById: adminId, kind: 'DAILY', status: 'MANUAL_REVIEW' },
      include: { assignment: { include: { campaign: true } } },
      orderBy: { uploadedAt: 'asc' },
      take: 25,
    });
    for (const photo of dailyPhotos) {
      items.push({
        id: photo.id,
        queue: 'daily_photos',
        title: `Daily Photo Review: ${photo.assignment.campaign.title}`,
        subtitle: `Score: ${photo.riskScore} - Attempt #${photo.attemptNo}`,
        priority: 'NORMAL',
        status: photo.status,
        createdAt: photo.uploadedAt.toISOString(),
        slaDueAt: new Date(photo.uploadedAt.getTime() + 24 * 60 * 60 * 1000).toISOString(),
        link: `/admin/daily-photos?id=${photo.id}`,
      });
    }

    return items;
  }

  /**
   * Assigns or unassigns an item in a specific review queue.
   */
  static async assignQueueItem(
    actingAdminId: string,
    queue: string,
    itemId: string,
    targetAdminId: string | null,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<void> {
    const now = new Date();

    switch (queue) {
      case 'kyc': {
        const item = await prisma.kycSubmission.findUnique({ where: { id: itemId } });
        if (!item) throw new NotFoundError('KYC submission not found');
        await prisma.kycSubmission.update({
          where: { id: itemId },
          data: { assignedToId: targetAdminId, assignedAt: targetAdminId ? now : null },
        });
        break;
      }

      case 'campaigns': {
        const item = await prisma.campaign.findUnique({ where: { id: itemId } });
        if (!item) throw new NotFoundError('Campaign not found');
        await prisma.campaign.update({
          where: { id: itemId },
          data: { assignedToId: targetAdminId, assignedAt: targetAdminId ? now : null },
        });
        break;
      }

      case 'installations': {
        const item = await prisma.assignment.findUnique({ where: { id: itemId } });
        if (!item) throw new NotFoundError('Assignment not found');
        await prisma.assignment.update({
          where: { id: itemId },
          data: { reviewClaimedById: targetAdminId, reviewClaimedAt: targetAdminId ? now : null },
        });
        break;
      }

      case 'daily_photos': {
        const item = await prisma.photo.findUnique({ where: { id: itemId } });
        if (!item) throw new NotFoundError('Photo not found');
        await prisma.photo.update({
          where: { id: itemId },
          data: { reviewClaimedById: targetAdminId, reviewClaimedAt: targetAdminId ? now : null },
        });
        break;
      }

      case 'disputes': {
        const item = await prisma.dispute.findUnique({ where: { id: itemId } });
        if (!item) throw new NotFoundError('Dispute not found');
        await prisma.dispute.update({
          where: { id: itemId },
          data: {
            assignedToId: targetAdminId,
            claimedAt: targetAdminId ? now : null,
            status: targetAdminId && item.status === 'OPEN' ? 'UNDER_REVIEW' : item.status,
          },
        });
        break;
      }

      default:
        throw new ValidationError(`Queue ${queue} does not support assignment`);
    }

    await AuditService.log({
      actorId: actingAdminId,
      actorType: ACTOR_TYPES.USER,
      action: 'QUEUE_ASSIGN',
      entityType: queue,
      entityId: itemId,
      newValues: { assignedToId: targetAdminId },
      ipAddress,
      userAgent,
    });
  }

  /**
   * Retrieves team member workload statistics.
   */
  static async getTeamWorkload(): Promise<TeamWorkloadMember[]> {
    const todayStart = new Date();
    todayStart.setUTCHours(0, 0, 0, 0);

    const admins = await prisma.user.findMany({
      where: {
        role: { in: [ROLES.SUPER_ADMIN, ROLES.MODERATOR, ROLES.FINANCE] },
        deletedAt: null,
      },
      select: {
        id: true,
        email: true,
        role: true,
        driverProfile: { select: { fullName: true } },
      },
      orderBy: { createdAt: 'asc' },
    });

    const results: TeamWorkloadMember[] = [];

    for (const a of admins) {
      const [kycAssigned, campAssigned, instAssigned, dispAssigned, photoAssigned, kycReviewedToday, campReviewedToday] =
        await Promise.all([
          prisma.kycSubmission.count({
            where: { assignedToId: a.id, status: KYC_SUBMISSION_STATUS.SUBMITTED },
          }),
          prisma.campaign.count({
            where: { assignedToId: a.id, status: CAMPAIGN_STATUS.SUBMITTED },
          }),
          prisma.assignment.count({
            where: { reviewClaimedById: a.id, status: ASSIGNMENT_STATUS.INSTALL_SUBMITTED },
          }),
          prisma.dispute.count({
            where: { assignedToId: a.id, status: { in: ['OPEN', 'UNDER_REVIEW'] } },
          }),
          prisma.photo.count({
            where: { reviewClaimedById: a.id, kind: 'DAILY', status: 'MANUAL_REVIEW' },
          }),
          prisma.kycSubmission.count({
            where: { reviewedById: a.id, reviewedAt: { gte: todayStart } },
          }),
          prisma.campaignReview.count({
            where: { reviewerId: a.id, createdAt: { gte: todayStart } },
          }),
        ]);

      const queuesBreakdown = {
        kyc: kycAssigned,
        campaigns: campAssigned,
        installations: instAssigned,
        disputes: dispAssigned,
        daily_photos: photoAssigned,
      };

      const assignedCount = kycAssigned + campAssigned + instAssigned + dispAssigned + photoAssigned;
      const completedTodayCount = kycReviewedToday + campReviewedToday;

      results.push({
        adminId: a.id,
        fullName: a.driverProfile?.fullName || a.email || 'Admin',
        email: a.email,
        role: a.role,
        assignedCount,
        completedTodayCount,
        queuesBreakdown,
      });
    }

    return results;
  }
}
