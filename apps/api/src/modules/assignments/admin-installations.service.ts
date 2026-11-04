import { prisma } from '../../shared/db/index.js';
import {
  ASSIGNMENT_STATUS,
  INSTALL_REVIEW_DECISIONS,
  ACTOR_TYPES,
  SETTING_KEYS,
  ERROR_CODES,
  type InstallReviewDecision,
} from '@ap/shared-constants';
import { AppError } from '../../shared/errors/index.js';
import { assignmentStateMachine } from './assignments.state-machine.js';
import { SettingsService } from '../settings/settings.service.js';
import { AuditService } from '../audit/audit.service.js';
import { eventBus } from '../../events/index.js';
import { storageProvider } from '../../integrations/storage/index.js';
import { todayIST, toISTDate, diffDaysIST, TimeService } from '../../shared/time/index.js';
import type { ReviewInstallationInput } from '@ap/shared-validation';
import type {
  InstallationReviewQueueItemDto,
  AssignmentDto,
} from '@ap/shared-types';
import { AssignmentsService } from './assignments.service.js';

export class AdminInstallationsService {
  /**
   * Retrieves FIFO review queue of installation photos pending verification by the platform.
   */
  static async getReviewQueue(
    adminUserId: string,
    filters: { assignedToMe?: boolean; unassigned?: boolean } = {},
  ): Promise<InstallationReviewQueueItemDto[]> {
    const slaHours = await SettingsService.get(SETTING_KEYS.CAMPAIGN_REVIEW_SLA_HOURS).catch(() => 24);
    const now = TimeService.now();

    const where: any = {
      status: ASSIGNMENT_STATUS.INSTALL_SUBMITTED,
      reviewOwner: 'PLATFORM',
    };

    if (filters.assignedToMe) {
      where.reviewClaimedById = adminUserId;
    } else if (filters.unassigned) {
      where.reviewClaimedById = null;
    }

    const assignments = await prisma.assignment.findMany({
      where,
      orderBy: { installedAt: 'asc' },
      include: {
        campaign: { include: { posterFile: true } },
        driver: { include: { driverProfile: true } },
        vehicle: true,
        reviewClaimedBy: true,
        photos: {
          where: { kind: 'INSTALLATION' },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    const items: InstallationReviewQueueItemDto[] = [];

    for (const a of assignments) {
      const latestPhoto = a.photos[0];
      const submittedAt = a.installedAt ?? a.updatedAt;
      const waitingMinutes = Math.max(0, Math.round((now.getTime() - submittedAt.getTime()) / (60 * 1000)));
      const isSlaBreached = waitingMinutes > slaHours * 60;

      let photoUrl = '';
      if (latestPhoto?.photoUrl) {
        photoUrl = await storageProvider.getSignedReadUrl(latestPhoto.photoUrl, 3600);
      }

      let posterPreviewUrl: string | null = null;
      if (a.campaign.posterFile?.thumbnailKey) {
        posterPreviewUrl = await storageProvider.getSignedReadUrl(a.campaign.posterFile.thumbnailKey, 3600);
      } else if (a.campaign.posterFile?.fileKey) {
        posterPreviewUrl = await storageProvider.getSignedReadUrl(a.campaign.posterFile.fileKey, 3600);
      }

      items.push({
        assignmentId: a.id,
        campaignId: a.campaignId,
        campaignTitle: a.campaign.title,
        driverId: a.driverId,
        driverName: a.driver.driverProfile?.fullName ?? null,
        driverMobile: a.driver.mobile,
        vehicleRegistrationNumber: a.vehicle.registrationNumber,
        cityName: a.campaign.title,
        attemptNo: a.installAttempts,
        submittedAt: submittedAt.toISOString(),
        waitingMinutes,
        isSlaBreached,
        reviewOwner: a.reviewOwner,
        claimedById: a.reviewClaimedById,
        claimedByName: a.reviewClaimedBy?.email ?? null,
        photoUrl,
        posterPreviewUrl,
      });
    }

    return items;
  }

  /**
   * Claims an installation review assignment for the moderator.
   */
  static async claim(adminUserId: string, assignmentId: string): Promise<AssignmentDto> {
    const assignment = await prisma.assignment.findUnique({
      where: { id: assignmentId },
      include: { campaign: true, vehicle: true, reviewClaimedBy: true },
    });

    if (!assignment) {
      throw new AppError(ERROR_CODES.ASSIGNMENT_NOT_FOUND, 404, 'Assignment not found');
    }

    if (assignment.reviewClaimedById && assignment.reviewClaimedById !== adminUserId) {
      throw new AppError(ERROR_CODES.ALREADY_CLAIMED, 409, 'This assignment is already claimed by another reviewer');
    }

    const now = TimeService.now();
    const updated = await prisma.assignment.update({
      where: { id: assignmentId },
      data: {
        reviewClaimedById: adminUserId,
        reviewClaimedAt: now,
      },
      include: { campaign: true, vehicle: true, reviewClaimedBy: true },
    });

    await AuditService.log({
      actorId: adminUserId,
      actorType: ACTOR_TYPES.USER,
      action: 'installation.claimed',
      entityType: 'Assignment',
      entityId: assignmentId,
      newValues: { reviewClaimedById: adminUserId },
    });

    return AssignmentsService.mapToDto(updated);
  }

  /**
   * Releases claim on an installation review.
   */
  static async release(adminUserId: string, assignmentId: string): Promise<AssignmentDto> {
    const assignment = await prisma.assignment.findUnique({
      where: { id: assignmentId },
      include: { campaign: true, vehicle: true, reviewClaimedBy: true },
    });

    if (!assignment) {
      throw new AppError(ERROR_CODES.ASSIGNMENT_NOT_FOUND, 404, 'Assignment not found');
    }

    const updated = await prisma.assignment.update({
      where: { id: assignmentId },
      data: {
        reviewClaimedById: null,
        reviewClaimedAt: null,
      },
      include: { campaign: true, vehicle: true, reviewClaimedBy: true },
    });

    await AuditService.log({
      actorId: adminUserId,
      actorType: ACTOR_TYPES.USER,
      action: 'installation.released',
      entityType: 'Assignment',
      entityId: assignmentId,
      newValues: { reviewClaimedById: null },
    });

    return AssignmentsService.mapToDto(updated);
  }

  /**
   * Submits a formal review decision on an installation.
   */
  static async decide(
    adminUserId: string,
    assignmentId: string,
    input: ReviewInstallationInput,
  ): Promise<AssignmentDto> {
    const assignment = await prisma.assignment.findUnique({
      where: { id: assignmentId },
      include: {
        campaign: true,
        vehicle: true,
        photos: {
          where: { kind: 'INSTALLATION' },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    if (!assignment) {
      throw new AppError(ERROR_CODES.ASSIGNMENT_NOT_FOUND, 404, 'Assignment not found');
    }

    if (assignment.status !== ASSIGNMENT_STATUS.INSTALL_SUBMITTED) {
      throw new AppError(
        ERROR_CODES.ASSIGNMENT_NOT_SUBMITTED,
        400,
        `Cannot decide installation in status ${assignment.status}. Must be INSTALL_SUBMITTED.`,
      );
    }

    const latestPhoto = assignment.photos[0];
    const now = TimeService.now();

    if (input.decision === INSTALL_REVIEW_DECISIONS.APPROVED) {
      await assignmentStateMachine.assertTransition(
        ASSIGNMENT_STATUS.INSTALL_SUBMITTED,
        ASSIGNMENT_STATUS.INSTALL_APPROVED,
      );

      // Rent Window calculation:
      // runStartDate = max(campaign.startDate, approvalDate)
      const approvalDateIST = todayIST();
      const campaignStartDateIST = toISTDate(assignment.campaign.startDate);
      const campaignEndDateIST = toISTDate(assignment.campaign.endDate);

      const runStartDateIST = approvalDateIST > campaignStartDateIST ? approvalDateIST : campaignStartDateIST;
      const windowDays = Math.max(1, diffDaysIST(runStartDateIST, campaignEndDateIST));

      const updated = await prisma.$transaction(async (tx) => {
        if (latestPhoto) {
          await tx.photo.update({
            where: { id: latestPhoto.id },
            data: {
              status: 'VERIFIED',
              reviewedByUserId: adminUserId,
              reviewedAt: now,
            },
          });
        }

        const res = await tx.assignment.update({
          where: { id: assignmentId },
          data: {
            status: ASSIGNMENT_STATUS.INSTALL_APPROVED,
            installApprovedAt: now,
            installApprovedByUserId: adminUserId,
            windowDays,
          },
          include: { campaign: true, vehicle: true },
        });

        return res;
      });

      await AuditService.log({
        actorId: adminUserId,
        actorType: ACTOR_TYPES.USER,
        action: 'installation.approved',
        entityType: 'Assignment',
        entityId: assignmentId,
        newValues: {
          decision: 'APPROVED',
          windowDays,
          printingAllowancePaise: assignment.campaign.printingAllowancePaise,
        },
      });

      // Emit event for printing allowance and start trigger
      eventBus.emit('assignment.install_approved', {
        assignmentId,
        campaignId: assignment.campaignId,
        driverId: assignment.driverId,
        printingAllowancePaise: assignment.campaign.printingAllowancePaise,
        windowDays,
      });

      return AssignmentsService.mapToDto(updated);
    }

    if (input.decision === INSTALL_REVIEW_DECISIONS.EXTRA_ATTEMPT_GRANTED) {
      // Grant 1 extra attempt to allow retry
      const updated = await prisma.assignment.update({
        where: { id: assignmentId },
        data: {
          status: ASSIGNMENT_STATUS.INSTALL_REJECTED,
          extraAttemptsGranted: { increment: 1 },
          installRejectReason: input.note ?? 'Extra attempt granted by admin',
        },
        include: { campaign: true, vehicle: true },
      });

      if (latestPhoto) {
        await prisma.photo.update({
          where: { id: latestPhoto.id },
          data: {
            status: 'REJECTED',
            reviewedByUserId: adminUserId,
            reviewedAt: now,
            failureReason: input.note,
            reviewReasonCodes: input.reasons as any,
          },
        });
      }

      await AuditService.log({
        actorId: adminUserId,
        actorType: ACTOR_TYPES.USER,
        action: 'installation.extra_attempt_granted',
        entityType: 'Assignment',
        entityId: assignmentId,
        newValues: { extraAttemptsGranted: updated.extraAttemptsGranted },
      });

      return AssignmentsService.mapToDto(updated);
    }

    const maxAttempts = await SettingsService.get(SETTING_KEYS.MAX_INSTALL_ATTEMPTS).catch(() => 3);
    const totalAllowed = maxAttempts + assignment.extraAttemptsGranted;
    const isExhausted = assignment.installAttempts >= totalAllowed;

    const nextStatus = isExhausted ? ASSIGNMENT_STATUS.TERMINATED : ASSIGNMENT_STATUS.INSTALL_REJECTED;

    await assignmentStateMachine.assertTransition(
      ASSIGNMENT_STATUS.INSTALL_SUBMITTED,
      nextStatus,
    );

    const updated = await prisma.$transaction(async (tx) => {
      if (latestPhoto) {
        await tx.photo.update({
          where: { id: latestPhoto.id },
          data: {
            status: 'REJECTED',
            reviewedByUserId: adminUserId,
            reviewedAt: now,
            failureReason: input.note,
            reviewReasonCodes: input.reasons as any,
          },
        });
      }

      const res = await tx.assignment.update({
        where: { id: assignmentId },
        data: {
          status: nextStatus,
          installRejectReason: input.note ?? input.reasons[0]?.code ?? 'Installation rejected',
        },
        include: { campaign: true, vehicle: true },
      });

      return res;
    });

    await AuditService.log({
      actorId: adminUserId,
      actorType: ACTOR_TYPES.USER,
      action: 'installation.rejected',
      entityType: 'Assignment',
      entityId: assignmentId,
      newValues: {
        decision: 'REJECTED',
        reasons: input.reasons,
        isExhausted,
        finalStatus: nextStatus,
      },
    });

    eventBus.emit('assignment.install_rejected', {
      assignmentId,
      campaignId: assignment.campaignId,
      driverId: assignment.driverId,
      reasons: input.reasons,
      isExhausted,
    });

    return AssignmentsService.mapToDto(updated);
  }
}
