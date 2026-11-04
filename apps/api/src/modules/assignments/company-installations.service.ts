import { prisma } from '../../shared/db/index.js';
import {
  ASSIGNMENT_STATUS,
  INSTALL_REVIEW_DECISIONS,
  ACTOR_TYPES,
  ERROR_CODES,
} from '@ap/shared-constants';
import { AppError } from '../../shared/errors/index.js';
import { assignmentStateMachine } from './assignments.state-machine.js';
import { AuditService } from '../audit/audit.service.js';
import { eventBus } from '../../events/index.js';
import { storageProvider } from '../../integrations/storage/index.js';
import { todayIST, toISTDate, diffDaysIST, TimeService } from '../../shared/time/index.js';
import type { ReviewInstallationInput } from '@ap/shared-validation';
import type { CompanyInstallationItemDto, AssignmentDto } from '@ap/shared-types';
import { AssignmentsService } from './assignments.service.js';

export class CompanyInstallationsService {
  /**
   * Masks a license plate number, e.g. GJ01AB1234 -> "*** 1234"
   */
  static maskPlate(plate: string): string {
    if (!plate || plate.length < 4) return '***';
    const last4 = plate.slice(-4);
    return `*** ${last4}`;
  }

  /**
   * Generates a sanitized pseudonymous driver code, e.g. DRV-8A2F
   */
  static generateDriverCode(driverId: string): string {
    return `DRV-${driverId.slice(0, 4).toUpperCase()}`;
  }

  /**
   * Retrieves sanitized list of installations for a company's campaign.
   */
  static async getCampaignInstallations(
    companyUserId: string,
    campaignId: string,
  ): Promise<CompanyInstallationItemDto[]> {
    const campaign = await prisma.campaign.findUnique({
      where: { id: campaignId },
      include: { posterFile: true },
    });

    if (!campaign) {
      throw new AppError(ERROR_CODES.CAMPAIGN_NOT_FOUND, 404, 'Campaign not found');
    }

    if (campaign.companyId !== companyUserId) {
      throw new AppError(ERROR_CODES.FORBIDDEN, 403, 'You do not own this campaign');
    }

    const assignments = await prisma.assignment.findMany({
      where: {
        campaignId,
        photos: { some: { kind: 'INSTALLATION' } },
      },
      orderBy: { installedAt: 'desc' },
      include: {
        vehicle: true,
        photos: {
          where: { kind: 'INSTALLATION' },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    let posterPreviewUrl: string | null = null;
    if (campaign.posterFile?.thumbnailKey) {
      posterPreviewUrl = await storageProvider.getSignedReadUrl(campaign.posterFile.thumbnailKey, 3600);
    } else if (campaign.posterFile?.fileKey) {
      posterPreviewUrl = await storageProvider.getSignedReadUrl(campaign.posterFile.fileKey, 3600);
    }

    const items: CompanyInstallationItemDto[] = [];

    for (const a of assignments) {
      const latestPhoto = a.photos[0];
      let photoUrl = '';
      if (latestPhoto?.photoUrl) {
        photoUrl = await storageProvider.getSignedReadUrl(latestPhoto.photoUrl, 3600);
      }

      items.push({
        assignmentId: a.id,
        campaignId: a.campaignId,
        driverCode: this.generateDriverCode(a.driverId),
        vehiclePlateMasked: this.maskPlate(a.vehicle.registrationNumber),
        cityName: campaign.title,
        attemptNo: a.installAttempts,
        submittedAt: (a.installedAt ?? a.updatedAt).toISOString(),
        reviewStatus: a.status,
        photoUrl,
        posterPreviewUrl,
      });
    }

    return items;
  }

  /**
   * Company decides on an installation photo for their own campaign.
   */
  static async decide(
    companyUserId: string,
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

    if (assignment.campaign.companyId !== companyUserId) {
      throw new AppError(ERROR_CODES.FORBIDDEN, 403, 'You do not own the campaign associated with this assignment');
    }

    if (assignment.status !== ASSIGNMENT_STATUS.INSTALL_SUBMITTED) {
      throw new AppError(
        ERROR_CODES.ASSIGNMENT_NOT_SUBMITTED,
        400,
        `Cannot decide installation in status ${assignment.status}`,
      );
    }

    const latestPhoto = assignment.photos[0];
    const now = TimeService.now();

    if (input.decision === INSTALL_REVIEW_DECISIONS.APPROVED) {
      await assignmentStateMachine.assertTransition(
        ASSIGNMENT_STATUS.INSTALL_SUBMITTED,
        ASSIGNMENT_STATUS.INSTALL_APPROVED,
      );

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
              reviewedByUserId: companyUserId,
              reviewedAt: now,
            },
          });
        }

        const res = await tx.assignment.update({
          where: { id: assignmentId },
          data: {
            status: ASSIGNMENT_STATUS.INSTALL_APPROVED,
            installApprovedAt: now,
            installApprovedByUserId: companyUserId,
            windowDays,
          },
          include: { campaign: true, vehicle: true },
        });

        return res;
      });

      await AuditService.log({
        actorId: companyUserId,
        actorType: ACTOR_TYPES.USER,
        action: 'installation.approved_by_company',
        entityType: 'Assignment',
        entityId: assignmentId,
        newValues: { decision: 'APPROVED', windowDays },
      });

      eventBus.emit('assignment.install_approved', {
        assignmentId,
        campaignId: assignment.campaignId,
        driverId: assignment.driverId,
        printingAllowancePaise: assignment.campaign.printingAllowancePaise,
        windowDays,
      });

      return AssignmentsService.mapToDto(updated);
    }

    const isExhausted = assignment.installAttempts >= 3 + assignment.extraAttemptsGranted;
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
            reviewedByUserId: companyUserId,
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
          installRejectReason: input.note ?? input.reasons[0]?.code ?? 'Installation rejected by company',
        },
        include: { campaign: true, vehicle: true },
      });

      return res;
    });

    await AuditService.log({
      actorId: companyUserId,
      actorType: ACTOR_TYPES.USER,
      action: 'installation.rejected_by_company',
      entityType: 'Assignment',
      entityId: assignmentId,
      newValues: { decision: 'REJECTED', reasons: input.reasons, isExhausted },
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
