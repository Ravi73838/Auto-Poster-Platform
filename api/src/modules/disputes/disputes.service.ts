import { prisma } from '../../shared/db/index.js';
import {
  DISPUTE_STATUS,
  DISPUTE_QUEUES,
  DISPUTE_PARTIES,
  DISPUTE_MESSAGE_VISIBILITY,
  DISPUTE_EFFECTS,
  ROLES,
  type Role,
  type DisputeStatus,
  type DisputeReason,
  type DisputeResolutionType,
  ERROR_CODES,
} from '@ap/shared-constants';
import { AppError } from '../../shared/errors/app-error.js';
import { disputeStateMachine } from './disputes.state-machine.js';
import { addBusinessDaysIST, calculateHoldAmount } from './disputes.math.js';
import { SettlementHoldProvider } from './settlement-hold.provider.js';
import { StrikeService } from '../discipline/strike.service.js';
import { TerminationService } from '../discipline/termination.service.js';
import { ReinstatementService } from '../discipline/reinstatement.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { emitEvent } from '../../events/index.js';
import { logger } from '../../shared/logger/index.js';
import type {
  CreateDriverDisputeInput,
  CreateCompanyDisputeInput,
  AddDisputeMessageInput,
  AddDisputeEvidenceInput,
  DisputeDecisionInput,
  DisputeRequestInfoInput,
  DisputeReopenRequestInput,
} from '@ap/shared-validation';

export class DisputesService {
  /**
   * Driver opens a dispute against platform or company.
   */
  static async createDriverDispute(driverUserId: string, input: CreateDriverDisputeInput) {
    // 1. Prevent duplicate open disputes for the same assignment or strike or photo
    const existing = await prisma.dispute.findFirst({
      where: {
        raisedByUserId: driverUserId,
        status: { in: [DISPUTE_STATUS.OPEN, DISPUTE_STATUS.UNDER_REVIEW] },
        OR: [
          ...(input.assignmentId ? [{ assignmentId: input.assignmentId }] : []),
          ...(input.strikeId ? [{ strikeId: input.strikeId }] : []),
          ...(input.photoId ? [{ photoId: input.photoId }] : []),
        ],
      },
    });

    if (existing) {
      throw new AppError(
        ERROR_CODES.CONFLICT,
        409,
        'An open dispute already exists for this subject',
      );
    }

    const assignment = input.assignmentId
      ? await prisma.assignment.findUnique({
          where: { id: input.assignmentId },
          include: { campaign: true },
        })
      : null;

    const claimedPaise = input.claimedAmountPaise ? BigInt(input.claimedAmountPaise) : 0n;
    const heldAmountPaise = calculateHoldAmount({
      reason: input.reason,
      assignment,
      claimedPaise,
    });

    const now = new Date();
    const slaDueAt = addBusinessDaysIST(now, 3);

    const isFinanceQueue =
      input.reason === 'PAYMENT_ISSUE' || input.reason === 'SETTLEMENT_AMOUNT';
    const queue = isFinanceQueue ? DISPUTE_QUEUES.FINANCE : DISPUTE_QUEUES.MODERATION;

    const result = await prisma.$transaction(async (tx) => {
      const dispute = await tx.dispute.create({
        data: {
          assignmentId: input.assignmentId,
          campaignId: assignment?.campaignId,
          photoId: input.photoId,
          strikeId: input.strikeId,
          disputedDate: input.disputedDate ? new Date(`${input.disputedDate}T00:00:00.000Z`) : undefined,
          raisedByUserId: driverUserId,
          role: ROLES.DRIVER,
          raisedByRole: ROLES.DRIVER,
          againstParty: DISPUTE_PARTIES.PLATFORM as any,
          reason: input.reason as any,
          details: input.description,
          status: DISPUTE_STATUS.OPEN as any,
          claimedAmountPaise: claimedPaise,
          heldAmountPaise,
          slaDueAt,
          queue: queue as any,
        },
      });

      // Initial message
      await tx.disputeMessage.create({
        data: {
          disputeId: dispute.id,
          authorId: driverUserId,
          authorRole: ROLES.DRIVER,
          body: input.description,
          visibleTo: DISPUTE_MESSAGE_VISIBILITY.BOTH as any,
        },
      });

      // Evidence files
      if (input.evidenceUploadedFileIds && input.evidenceUploadedFileIds.length > 0) {
        const uploadedFiles = await tx.uploadedFile.findMany({
          where: { id: { in: input.evidenceUploadedFileIds } },
        });
        for (const file of uploadedFiles) {
          await tx.disputeEvidence.create({
            data: {
              disputeId: dispute.id,
              uploadedByUserId: driverUserId,
              fileUrl: file.fileKey,
              visibleToOtherParty: false, // Default hidden from company to protect driver privacy
            },
          });
        }
      }

      // Timeline event
      await tx.disputeEvent.create({
        data: {
          disputeId: dispute.id,
          type: 'DISPUTE_OPENED',
          actorId: driverUserId,
          data: {
            reason: input.reason,
            claimedAmountPaise: claimedPaise.toString(),
            heldAmountPaise: heldAmountPaise.toString(),
          },
        },
      });

      // Audit log
      await tx.auditLog.create({
        data: {
          actorId: driverUserId,
          actorType: 'USER',
          action: 'DISPUTE_OPENED',
          entityType: 'DISPUTE',
          entityId: dispute.id,
          newValues: {
            reason: input.reason,
            claimedAmountPaise: claimedPaise.toString(),
            heldAmountPaise: heldAmountPaise.toString(),
          },
        },
      });

      return dispute;
    });

    emitEvent('dispute.opened', {
      disputeId: result.id,
      assignmentId: result.assignmentId,
      campaignId: result.campaignId,
      raisedByUserId: driverUserId,
      raisedByRole: ROLES.DRIVER,
      reason: input.reason,
      queue,
      heldAmountPaise: heldAmountPaise.toString(),
      slaDueAt,
    });

    NotificationsService.notify({
      key: 'dispute.opened',
      userId: driverUserId,
      data: {
        disputeId: result.id,
        reason: input.reason,
      },
    }).catch((err) => {
      logger.error({ err, disputeId: result.id }, '[DisputesService] Failed to notify driver of dispute');
    });

    return result;
  }

  /**
   * Company opens a dispute against driver (with privacy guarantee: company does not see driver personal details).
   */
  static async createCompanyDispute(companyUserId: string, input: CreateCompanyDisputeInput) {
    const campaign = await prisma.campaign.findUnique({
      where: { id: input.campaignId },
    });

    if (!campaign || campaign.companyId !== companyUserId) {
      throw new AppError(ERROR_CODES.UNAUTHORIZED, 403, 'Unauthorized to dispute this campaign');
    }

    const assignment = input.assignmentId
      ? await prisma.assignment.findUnique({
          where: { id: input.assignmentId },
        })
      : null;

    const existing = await prisma.dispute.findFirst({
      where: {
        raisedByUserId: companyUserId,
        status: { in: [DISPUTE_STATUS.OPEN, DISPUTE_STATUS.UNDER_REVIEW] },
        OR: [
          ...(input.assignmentId ? [{ assignmentId: input.assignmentId }] : []),
          ...(input.photoId ? [{ photoId: input.photoId }] : []),
        ],
      },
    });

    if (existing) {
      throw new AppError(
        ERROR_CODES.CONFLICT,
        409,
        'An open dispute already exists for this subject',
      );
    }

    const now = new Date();
    const slaDueAt = addBusinessDaysIST(now, 3);
    const queue = DISPUTE_QUEUES.MODERATION;

    const result = await prisma.$transaction(async (tx) => {
      const dispute = await tx.dispute.create({
        data: {
          assignmentId: input.assignmentId,
          campaignId: input.campaignId,
          photoId: input.photoId,
          disputedDate: input.disputedDate ? new Date(`${input.disputedDate}T00:00:00.000Z`) : undefined,
          raisedByUserId: companyUserId,
          role: ROLES.COMPANY,
          raisedByRole: ROLES.COMPANY,
          againstParty: DISPUTE_PARTIES.DRIVER as any,
          reason: input.reason as any,
          details: input.description,
          status: DISPUTE_STATUS.OPEN as any,
          claimedAmountPaise: 0n,
          heldAmountPaise: 0n,
          slaDueAt,
          queue: queue as any,
        },
      });

      // Initial message
      await tx.disputeMessage.create({
        data: {
          disputeId: dispute.id,
          authorId: companyUserId,
          authorRole: ROLES.COMPANY,
          body: input.description,
          visibleTo: DISPUTE_MESSAGE_VISIBILITY.BOTH as any,
        },
      });

      // Evidence files
      if (input.evidenceUploadedFileIds && input.evidenceUploadedFileIds.length > 0) {
        const uploadedFiles = await tx.uploadedFile.findMany({
          where: { id: { in: input.evidenceUploadedFileIds } },
        });
        for (const file of uploadedFiles) {
          await tx.disputeEvidence.create({
            data: {
              disputeId: dispute.id,
              uploadedByUserId: companyUserId,
              fileUrl: file.fileKey,
              visibleToOtherParty: true,
            },
          });
        }
      }

      await tx.disputeEvent.create({
        data: {
          disputeId: dispute.id,
          type: 'DISPUTE_OPENED',
          actorId: companyUserId,
          data: { reason: input.reason },
        },
      });

      await tx.auditLog.create({
        data: {
          actorId: companyUserId,
          actorType: 'USER',
          action: 'DISPUTE_OPENED',
          entityType: 'DISPUTE',
          entityId: dispute.id,
          newValues: { reason: input.reason },
        },
      });

      return dispute;
    });

    emitEvent('dispute.opened', {
      disputeId: result.id,
      assignmentId: result.assignmentId,
      campaignId: result.campaignId,
      raisedByUserId: companyUserId,
      raisedByRole: ROLES.COMPANY,
      reason: input.reason,
      queue,
      heldAmountPaise: '0',
      slaDueAt,
    });

    NotificationsService.notify({
      key: 'dispute.opened',
      userId: companyUserId,
      data: {
        disputeId: result.id,
        reason: input.reason,
      },
    }).catch((err) => {
      logger.error({ err, disputeId: result.id }, '[DisputesService] Failed to notify company of dispute');
    });

    return result;
  }

  /**
   * Adds a message to the dispute thread.
   */
  static async addMessage(
    disputeId: string,
    authorId: string,
    authorRole: Role,
    input: AddDisputeMessageInput,
  ) {
    const dispute = await prisma.dispute.findUnique({
      where: { id: disputeId },
      include: {
        raisedByUser: true,
        assignment: { include: { driver: true } },
      },
    });

    if (!dispute) {
      throw new AppError(ERROR_CODES.NOT_FOUND, 404, 'Dispute not found');
    }

    if (dispute.status === DISPUTE_STATUS.WITHDRAWN) {
      throw new AppError(ERROR_CODES.DISPUTE_CLOSED, 400, 'Cannot message on withdrawn dispute');
    }

    let visibleTo = input.visibleTo ?? DISPUTE_MESSAGE_VISIBILITY.BOTH;
    if (authorRole !== ROLES.SUPER_ADMIN && authorRole !== ROLES.MODERATOR) {
      visibleTo = DISPUTE_MESSAGE_VISIBILITY.BOTH;
    }

    const message = await prisma.disputeMessage.create({
      data: {
        disputeId,
        authorId,
        authorRole,
        body: input.body,
        visibleTo: visibleTo as any,
      },
    });

    await prisma.disputeEvent.create({
      data: {
        disputeId,
        type: 'MESSAGE_ADDED',
        actorId: authorId,
        data: { visibleTo, authorRole },
      },
    });

    // Notify the other party if message is visible
    if (visibleTo === DISPUTE_MESSAGE_VISIBILITY.BOTH || visibleTo === DISPUTE_MESSAGE_VISIBILITY.DRIVER) {
      if (authorId !== dispute.raisedByUserId && dispute.raisedByRole === ROLES.DRIVER) {
        NotificationsService.notify({
          key: 'dispute.message',
          userId: dispute.raisedByUserId,
          data: { disputeId },
        }).catch(() => null);
      }
    }

    return message;
  }

  /**
   * Adds evidence document/photo to dispute.
   */
  static async addEvidence(
    disputeId: string,
    uploaderId: string,
    uploaderRole: Role,
    input: AddDisputeEvidenceInput,
  ) {
    const dispute = await prisma.dispute.findUnique({
      where: { id: disputeId },
    });

    if (!dispute) {
      throw new AppError(ERROR_CODES.NOT_FOUND, 404, 'Dispute not found');
    }

    const isVisible =
      uploaderRole === ROLES.COMPANY
        ? true
        : uploaderRole === ROLES.DRIVER
        ? false // Privacy default
        : Boolean(input.visibleToOtherParty);

    const evidence = await prisma.disputeEvidence.create({
      data: {
        disputeId,
        uploadedByUserId: uploaderId,
        fileUrl: input.uploadedFileId,
        notes: input.notes,
        visibleToOtherParty: isVisible,
      },
    });

    await prisma.disputeEvent.create({
      data: {
        disputeId,
        type: 'EVIDENCE_ADDED',
        actorId: uploaderId,
        data: { evidenceId: evidence.id, visibleToOtherParty: isVisible },
      },
    });

    return evidence;
  }

  /**
   * Admin sets whether driver evidence is visible to company.
   */
  static async setEvidenceVisibility(
    disputeId: string,
    evidenceId: string,
    adminUserId: string,
    visible: boolean,
  ) {
    const evidence = await prisma.disputeEvidence.update({
      where: { id: evidenceId },
      data: { visibleToOtherParty: visible },
    });

    await prisma.disputeEvent.create({
      data: {
        disputeId,
        type: 'EVIDENCE_VISIBILITY_CHANGED',
        actorId: adminUserId,
        data: { evidenceId, visibleToOtherParty: visible },
      },
    });

    return evidence;
  }

  /**
   * Admin queue claims next oldest dispute in queue.
   */
  static async claimNext(adminUserId: string, queue?: string) {
    const where: any = {
      status: DISPUTE_STATUS.OPEN,
      assignedToId: null,
    };
    if (queue) {
      where.queue = queue;
    }

    const oldest = await prisma.dispute.findFirst({
      where,
      orderBy: { createdAt: 'asc' },
    });

    if (!oldest) {
      return null;
    }

    return this.claim(oldest.id, adminUserId);
  }

  /**
   * Admin claims specific dispute.
   */
  static async claim(disputeId: string, adminUserId: string) {
    const dispute = await prisma.dispute.findUnique({
      where: { id: disputeId },
    });

    if (!dispute) {
      throw new AppError(ERROR_CODES.NOT_FOUND, 404, 'Dispute not found');
    }

    await disputeStateMachine.assertTransition(dispute.status as DisputeStatus, DISPUTE_STATUS.UNDER_REVIEW);

    const updated = await prisma.dispute.update({
      where: { id: disputeId },
      data: {
        status: DISPUTE_STATUS.UNDER_REVIEW as any,
        assignedToId: adminUserId,
        claimedAt: new Date(),
      },
    });

    await prisma.disputeEvent.create({
      data: {
        disputeId,
        type: 'DISPUTE_CLAIMED',
        actorId: adminUserId,
      },
    });

    emitEvent('dispute.claimed', {
      disputeId,
      assignedToId: adminUserId,
    });

    return updated;
  }

  /**
   * Admin releases dispute back to pool.
   */
  static async release(disputeId: string, adminUserId: string) {
    const dispute = await prisma.dispute.findUnique({
      where: { id: disputeId },
    });

    if (!dispute) {
      throw new AppError(ERROR_CODES.NOT_FOUND, 404, 'Dispute not found');
    }

    const updated = await prisma.dispute.update({
      where: { id: disputeId },
      data: {
        status: DISPUTE_STATUS.OPEN as any,
        assignedToId: null,
        claimedAt: null,
      },
    });

    await prisma.disputeEvent.create({
      data: {
        disputeId,
        type: 'DISPUTE_RELEASED',
        actorId: adminUserId,
      },
    });

    return updated;
  }

  /**
   * Admin requests more information from driver or company.
   */
  static async requestInfo(
    disputeId: string,
    adminUserId: string,
    input: DisputeRequestInfoInput,
  ) {
    const dispute = await prisma.dispute.findUnique({
      where: { id: disputeId },
      include: {
        raisedByUser: true,
        assignment: { include: { driver: true } },
      },
    });

    if (!dispute) {
      throw new AppError(ERROR_CODES.NOT_FOUND, 404, 'Dispute not found');
    }

    const targetVisibility =
      input.targetParty === 'DRIVER'
        ? DISPUTE_MESSAGE_VISIBILITY.DRIVER
        : input.targetParty === 'COMPANY'
        ? DISPUTE_MESSAGE_VISIBILITY.COMPANY
        : DISPUTE_MESSAGE_VISIBILITY.BOTH;

    const message = await prisma.disputeMessage.create({
      data: {
        disputeId,
        authorId: adminUserId,
        authorRole: ROLES.MODERATOR,
        body: input.message,
        visibleTo: targetVisibility as any,
      },
    });

    await prisma.disputeEvent.create({
      data: {
        disputeId,
        type: 'INFO_REQUESTED',
        actorId: adminUserId,
        data: { targetParty: input.targetParty, message: input.message },
      },
    });

    // Send notifications
    if (input.targetParty === 'DRIVER' || input.targetParty === 'BOTH') {
      const driverUserId = dispute.assignment?.driverId ?? dispute.raisedByUserId;
      NotificationsService.notify({
        key: 'dispute.info_requested',
        userId: driverUserId,
        data: { disputeId, message: input.message },
      }).catch(() => null);
    }

    return message;
  }

  /**
   * Previews resolution effects without modifying database state.
   */
  static async decisionPreview(disputeId: string, input: DisputeDecisionInput) {
    const dispute = await prisma.dispute.findUnique({
      where: { id: disputeId },
      include: {
        assignment: { include: { campaign: true } },
      },
    });

    if (!dispute) {
      throw new AppError(ERROR_CODES.NOT_FOUND, 404, 'Dispute not found');
    }

    const previewEffects = input.effects.map((effect) => {
      switch (effect) {
        case DISPUTE_EFFECTS.OVERTURN_PHOTO_REJECTION:
          return 'Will mark the disputed daily or installation photo as VERIFIED / APPROVED.';
        case DISPUTE_EFFECTS.EXCUSE_DAY:
          return 'Will excuse the missed day without deducting driver pay.';
        case DISPUTE_EFFECTS.REVOKE_STRIKE:
          return 'Will revoke the active/consumed strike and check if temporary ban can be lifted.';
        case DISPUTE_EFFECTS.LIFT_BAN:
          return 'Will immediately lift the driver ban.';
        case DISPUTE_EFFECTS.REINSTATE_ASSIGNMENT:
          return 'Will reinstate the assignment back to RUNNING and excuse gap days.';
        case DISPUTE_EFFECTS.TERMINATE_ASSIGNMENT:
          return 'Will terminate the assignment and free the campaign slot.';
        case DISPUTE_EFFECTS.RELEASE_HOLD:
          return `Will release held amount (${dispute.heldAmountPaise?.toString() ?? '0'} paise) between parties.`;
        default:
          return `Will execute effect: ${effect}`;
      }
    });

    return {
      disputeId,
      resolutionType: input.resolutionType,
      decisionText: input.decisionText,
      toDriverPaise: input.toDriverPaise ?? '0',
      toCompanyPaise: input.toCompanyPaise ?? '0',
      effectsSummary: previewEffects,
    };
  }

  /**
   * Executes decision on dispute: runs all 12 typed effects in one DB tx with audit logs.
   */
  static async executeDecision(
    disputeId: string,
    adminUserId: string,
    input: DisputeDecisionInput,
  ) {
    const dispute = await prisma.dispute.findUnique({
      where: { id: disputeId },
      include: {
        assignment: { include: { campaign: true, driver: true } },
      },
    });

    if (!dispute) {
      throw new AppError(ERROR_CODES.NOT_FOUND, 404, 'Dispute not found');
    }

    const nextStatus =
      input.resolutionType === 'NO_ACTION'
        ? DISPUTE_STATUS.REJECTED
        : DISPUTE_STATUS.RESOLVED;

    await disputeStateMachine.assertTransition(dispute.status as DisputeStatus, nextStatus as DisputeStatus);

    const now = new Date();
    const toDriverPaise = input.toDriverPaise ? BigInt(input.toDriverPaise) : 0n;
    const toCompanyPaise = input.toCompanyPaise ? BigInt(input.toCompanyPaise) : 0n;

    await prisma.$transaction(async (tx) => {
      // 1. Process effects
      for (const effect of input.effects) {
        switch (effect) {
          case DISPUTE_EFFECTS.OVERTURN_PHOTO_REJECTION: {
            if (dispute.photoId && dispute.assignmentId) {
              await tx.photo.update({
                where: { id: dispute.photoId },
                data: { status: 'VERIFIED' },
              });
              if (dispute.disputedDate) {
                await tx.assignmentDay.updateMany({
                  where: {
                    assignmentId: dispute.assignmentId,
                    date: dispute.disputedDate,
                  },
                  data: { status: 'VERIFIED' },
                });
              }
            }
            break;
          }

          case DISPUTE_EFFECTS.EXCUSE_DAY: {
            if (dispute.assignmentId && dispute.disputedDate) {
              await tx.assignmentDay.updateMany({
                where: {
                  assignmentId: dispute.assignmentId,
                  date: dispute.disputedDate,
                },
                data: {
                  status: 'EXCUSED',
                  excuseNote: `Dispute #${dispute.id} resolution`,
                  excusedById: adminUserId,
                },
              });
            }
            break;
          }

          case DISPUTE_EFFECTS.REVOKE_STRIKE: {
            if (dispute.strikeId) {
              await StrikeService.revoke(dispute.strikeId, {
                revokedBy: adminUserId,
                reason: `Dispute #${dispute.id}: ${input.decisionText}`,
                tx,
              });
            }
            break;
          }

          case DISPUTE_EFFECTS.REINSTATE_ASSIGNMENT: {
            if (dispute.assignmentId) {
              await ReinstatementService.reinstate(dispute.assignmentId, {
                reinstatedBy: adminUserId,
                reason: `Dispute #${dispute.id}: ${input.decisionText}`,
                tx,
              });
            }
            break;
          }

          case DISPUTE_EFFECTS.TERMINATE_ASSIGNMENT: {
            if (dispute.assignmentId) {
              await TerminationService.terminate(dispute.assignmentId, {
                reason: 'DISPUTE_DECISION',
                terminatedById: adminUserId,
                notes: input.decisionText,
                tx,
              });
            }
            break;
          }

          case DISPUTE_EFFECTS.RELEASE_HOLD: {
            if (toDriverPaise > 0n) {
              await SettlementHoldProvider.releaseHeld({
                disputeId: dispute.id,
                toParty: 'DRIVER',
                amountPaise: toDriverPaise,
                tx,
              });
            }
            if (toCompanyPaise > 0n) {
              await SettlementHoldProvider.releaseHeld({
                disputeId: dispute.id,
                toParty: 'COMPANY',
                amountPaise: toCompanyPaise,
                tx,
              });
            }
            break;
          }
        }
      }

      // 2. Update dispute status
      await tx.dispute.update({
        where: { id: disputeId },
        data: {
          status: nextStatus as any,
          resolutionType: input.resolutionType as any,
          resolution: input.decisionText,
          resolutionToDriverPaise: toDriverPaise,
          resolutionToCompanyPaise: toCompanyPaise,
          resolvedAt: now,
          closedAt: now,
          resolvedByUserId: adminUserId,
        },
      });

      // 3. Add system resolution message
      await tx.disputeMessage.create({
        data: {
          disputeId,
          authorId: adminUserId,
          authorRole: ROLES.MODERATOR,
          body: `Resolution (${input.resolutionType}): ${input.decisionText}`,
          visibleTo: DISPUTE_MESSAGE_VISIBILITY.BOTH as any,
        },
      });

      // 4. Create timeline event
      await tx.disputeEvent.create({
        data: {
          disputeId,
          type: 'DISPUTE_RESOLVED',
          actorId: adminUserId,
          data: {
            resolutionType: input.resolutionType,
            decisionText: input.decisionText,
            effects: input.effects,
            toDriverPaise: toDriverPaise.toString(),
            toCompanyPaise: toCompanyPaise.toString(),
          },
        },
      });

      // 5. Audit log
      await tx.auditLog.create({
        data: {
          actorId: adminUserId,
          actorType: 'USER',
          action: 'DISPUTE_RESOLVED',
          entityType: 'DISPUTE',
          entityId: disputeId,
          newValues: {
            resolutionType: input.resolutionType,
            decisionText: input.decisionText,
            effects: input.effects,
          },
        },
      });
    });

    emitEvent('dispute.resolved', {
      disputeId,
      resolvedByUserId: adminUserId,
      resolutionType: input.resolutionType,
      resolutionText: input.decisionText,
      effects: input.effects,
    });

    NotificationsService.notify({
      key: 'dispute.resolved',
      userId: dispute.raisedByUserId,
      data: {
        disputeId: dispute.id,
        decision: input.decisionText,
      },
    }).catch(() => null);

    return {
      disputeId,
      status: nextStatus,
      resolutionType: input.resolutionType,
      decision: input.decisionText,
    };
  }

  /**
   * Submits a request for second-level review (applicant appeal).
   */
  static async requestReopen(
    disputeId: string,
    userId: string,
    input: DisputeReopenRequestInput,
  ) {
    const dispute = await prisma.dispute.findUnique({
      where: { id: disputeId },
    });

    if (!dispute) {
      throw new AppError(ERROR_CODES.NOT_FOUND, 404, 'Dispute not found');
    }

    if (
      dispute.status !== DISPUTE_STATUS.RESOLVED &&
      dispute.status !== DISPUTE_STATUS.REJECTED
    ) {
      throw new AppError(
        ERROR_CODES.INVALID_STATE_TRANSITION,
        400,
        'Only resolved or rejected disputes can be reopened',
      );
    }

    const updated = await prisma.dispute.update({
      where: { id: disputeId },
      data: {
        reopenRequestedAt: new Date(),
        reopenRequestedById: userId,
      },
    });

    await prisma.disputeEvent.create({
      data: {
        disputeId,
        type: 'REOPEN_REQUESTED',
        actorId: userId,
        data: { reason: input.reason },
      },
    });

    return updated;
  }

  /**
   * Super Admin accepts reopening: transitions back to UNDER_REVIEW at reviewLevel = 2.
   */
  static async acceptReopen(disputeId: string, superAdminUserId: string) {
    const dispute = await prisma.dispute.findUnique({
      where: { id: disputeId },
    });

    if (!dispute) {
      throw new AppError(ERROR_CODES.NOT_FOUND, 404, 'Dispute not found');
    }

    await disputeStateMachine.assertTransition(dispute.status as DisputeStatus, DISPUTE_STATUS.UNDER_REVIEW);

    const now = new Date();
    const updated = await prisma.dispute.update({
      where: { id: disputeId },
      data: {
        status: DISPUTE_STATUS.UNDER_REVIEW as any,
        reviewLevel: 2,
        assignedToId: superAdminUserId,
        claimedAt: now,
        slaDueAt: addBusinessDaysIST(now, 2),
      },
    });

    await prisma.disputeEvent.create({
      data: {
        disputeId,
        type: 'REOPEN_ACCEPTED',
        actorId: superAdminUserId,
        data: { reviewLevel: 2 },
      },
    });

    NotificationsService.notify({
      key: 'dispute.reopen_decision',
      userId: dispute.raisedByUserId,
      data: {
        disputeId,
        decision: 'Second-level review accepted by Super Admin',
      },
    }).catch(() => null);

    return updated;
  }

  /**
   * Retrieves full workspace detail with privacy masking.
   */
  static async getWorkspaceDetail(disputeId: string, role: Role, userId: string) {
    const dispute = await prisma.dispute.findUnique({
      where: { id: disputeId },
      include: {
        raisedByUser: { select: { id: true, mobile: true, email: true, role: true } },
        assignedTo: { select: { id: true, mobile: true, email: true } },
        assignment: {
          include: {
            campaign: { select: { id: true, title: true, companyId: true } },
            driver: { select: { id: true, mobile: true, email: true, driverProfile: { select: { fullName: true } } } },
            days: { orderBy: { date: 'asc' } },
            photos: { orderBy: { uploadedAt: 'desc' } },
          },
        },
        evidences: true,
        messages: {
          orderBy: { createdAt: 'asc' },
          include: { author: { select: { id: true, mobile: true, email: true, role: true } } },
        },
        events: { orderBy: { createdAt: 'asc' } },
      },
    });

    if (!dispute) {
      throw new AppError(ERROR_CODES.NOT_FOUND, 404, 'Dispute not found');
    }

    // Role-based visibility filtering
    let visibleMessages = dispute.messages;
    let visibleEvidences = dispute.evidences;

    if (role === ROLES.COMPANY) {
      visibleMessages = dispute.messages.filter(
        (m) =>
          m.visibleTo === DISPUTE_MESSAGE_VISIBILITY.BOTH ||
          m.visibleTo === DISPUTE_MESSAGE_VISIBILITY.COMPANY,
      );
      visibleEvidences = dispute.evidences.filter(
        (e) => e.visibleToOtherParty || e.uploadedByUserId === userId,
      );
    } else if (role === ROLES.DRIVER) {
      visibleMessages = dispute.messages.filter(
        (m) =>
          m.visibleTo === DISPUTE_MESSAGE_VISIBILITY.BOTH ||
          m.visibleTo === DISPUTE_MESSAGE_VISIBILITY.DRIVER,
      );
    }

    // Mask driver identity for companies
    let safeAssignment: any = dispute.assignment;
    if (role === ROLES.COMPANY && safeAssignment) {
      safeAssignment = {
        ...safeAssignment,
        driver: {
          id: safeAssignment.driverId,
          driverProfile: {
            fullName: 'Assigned Driver',
          },
        },
      };
    }

    return {
      ...dispute,
      assignment: safeAssignment,
      messages: visibleMessages,
      evidences: visibleEvidences,
    };
  }

  /**
   * Lists disputes with filtering and pagination.
   */
  static async listDisputes(options: {
    role?: Role;
    userId?: string;
    status?: string;
    queue?: string;
    assignedToId?: string;
    page?: number;
    limit?: number;
  }) {
    const page = Math.max(1, options.page ?? 1);
    const limit = Math.max(1, Math.min(100, options.limit ?? 20));
    const skip = (page - 1) * limit;

    const where: any = {};
    if (options.status) where.status = options.status;
    if (options.queue) where.queue = options.queue;
    if (options.assignedToId) where.assignedToId = options.assignedToId;

    if (options.role === ROLES.DRIVER && options.userId) {
      where.raisedByUserId = options.userId;
    } else if (options.role === ROLES.COMPANY && options.userId) {
      where.OR = [
        { raisedByUserId: options.userId },
        { campaign: { companyId: options.userId } },
      ];
    }

    const [items, total] = await Promise.all([
      prisma.dispute.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          raisedByUser: { select: { id: true, mobile: true, email: true, role: true } },
          assignedTo: { select: { id: true, mobile: true, email: true } },
          campaign: { select: { id: true, title: true } },
        },
      }),
      prisma.dispute.count({ where }),
    ]);

    return {
      items,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}
