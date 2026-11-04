import { prisma } from '../../shared/db/index.js';
import {
  ASSIGNMENT_STATUS,
  ERROR_CODES,
} from '@ap/shared-constants';
import { AppError } from '../../shared/errors/app-error.js';
import { assignmentStateMachine } from '../assignments/assignments.state-machine.js';
import { getISTTime } from '../notifications/notifications.helpers.js';
import { emitEvent } from '../../events/index.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { logger } from '../../shared/logger/index.js';

export interface TerminateAssignmentParams {
  reason: string;
  terminatedById?: string;
  notes?: string;
  tx?: any;
}

export class TerminationService {
  static async terminate(assignmentId: string, params: TerminateAssignmentParams) {
    const runInTx = async (tx: any) => {
      const assignment = await tx.assignment.findUnique({
        where: { id: assignmentId },
        include: {
          campaign: {
            include: { company: true },
          },
          driver: true,
        },
      });

      if (!assignment) {
        throw new AppError(ERROR_CODES.NOT_FOUND, 404, 'Assignment not found');
      }

      if (
        assignment.status === ASSIGNMENT_STATUS.TERMINATED ||
        assignment.status === ASSIGNMENT_STATUS.COMPLETED
      ) {
        logger.info({ assignmentId, status: assignment.status }, '[TerminationService] Assignment already ended');
        return assignment;
      }

      // Validate state transition
      await assignmentStateMachine.assertTransition(assignment.status, ASSIGNMENT_STATUS.TERMINATED);

      const now = new Date();
      const { dateStr } = getISTTime(now);
      const effectiveDate = new Date(`${dateStr}T00:00:00.000Z`);

      // Adjust endedAt if running
      const endedAt = now;

      // Close out assignment days
      // 1. Delete days after effective date
      await tx.assignmentDay.deleteMany({
        where: {
          assignmentId,
          date: { gt: effectiveDate },
        },
      });

      // 2. Mark any pending/open days on or before effective date as MISSED
      await tx.assignmentDay.updateMany({
        where: {
          assignmentId,
          date: { lte: effectiveDate },
          status: 'PENDING',
        },
        data: {
          status: 'MISSED',
        },
      });

      // 3. Recompute counters
      const [verifiedCount, missedCount, excusedCount] = await Promise.all([
        tx.assignmentDay.count({
          where: { assignmentId, status: 'VERIFIED' },
        }),
        tx.assignmentDay.count({
          where: { assignmentId, status: 'MISSED' },
        }),
        tx.assignmentDay.count({
          where: { assignmentId, status: 'EXCUSED' },
        }),
      ]);

      const isValidUuid = (val?: string) =>
        Boolean(val && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(val));
      const dbTerminatedById = isValidUuid(params.terminatedById) ? params.terminatedById : null;

      // 4. Update assignment
      const updatedAssignment = await tx.assignment.update({
        where: { id: assignmentId },
        data: {
          status: ASSIGNMENT_STATUS.TERMINATED,
          endedAt,
          terminatedAt: now,
          terminationDate: effectiveDate,
          terminatedById: dbTerminatedById,
          verifiedDays: verifiedCount,
          missedDays: missedCount,
          excusedDays: excusedCount,
        },
      });

      // 5. Decrement campaign enrolledCount if it was counted
      if (
        assignment.status === ASSIGNMENT_STATUS.RUNNING ||
        assignment.status === ASSIGNMENT_STATUS.INSTALL_APPROVED
      ) {
        await tx.campaign.update({
          where: { id: assignment.campaignId },
          data: {
            enrolledCount: {
              decrement: 1,
            },
          },
        });
      }

      // 6. Record Audit Log
      await tx.auditLog.create({
        data: {
          actorId: dbTerminatedById,
          actorType: dbTerminatedById ? 'USER' : 'SYSTEM',
          action: 'ASSIGNMENT_TERMINATED',
          entityType: 'ASSIGNMENT',
          entityId: assignmentId,
          oldValues: { status: assignment.status },
          newValues: {
            status: ASSIGNMENT_STATUS.TERMINATED,
            reason: params.reason,
            notes: params.notes,
          },
        },
      });

      return {
        assignment: updatedAssignment,
        driverUserId: assignment.driverId,
        companyUserId: assignment.campaign.companyId,
        campaignTitle: assignment.campaign.title,
        campaignId: assignment.campaignId,
        driverId: assignment.driverId,
      };
    };

    const res = params.tx ? await runInTx(params.tx) : await prisma.$transaction(runInTx);

    // Emit event & dispatch notifications
    emitEvent('assignment.terminated', {
      assignmentId,
      campaignId: res.campaignId,
      driverId: res.driverId,
      reason: params.reason,
      terminatedById: params.terminatedById ?? null,
      terminationDate: getISTTime().dateStr,
      note: params.notes ?? null,
    });

    NotificationsService.notify({
      key: 'assignment.terminated',
      userId: res.driverUserId,
      data: {
        title: res.campaignTitle,
        reason: params.reason,
      },
    }).catch((err) => {
      logger.error({ err, assignmentId }, '[TerminationService] Failed to notify driver');
    });

    NotificationsService.notify({
      key: 'assignment.slot_freed',
      userId: res.companyUserId,
      data: {
        title: res.campaignTitle,
      },
    }).catch((err) => {
      logger.error({ err, assignmentId }, '[TerminationService] Failed to notify company');
    });

    return res.assignment;
  }
}
