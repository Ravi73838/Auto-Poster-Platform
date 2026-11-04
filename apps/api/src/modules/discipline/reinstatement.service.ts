import { prisma } from '../../shared/db/index.js';
import {
  ASSIGNMENT_STATUS,
  SETTLEMENT_STATUS,
  CAMPAIGN_STATUS,
  ERROR_CODES,
} from '@ap/shared-constants';
import { AppError } from '../../shared/errors/app-error.js';
import { assignmentStateMachine } from '../assignments/assignments.state-machine.js';
import { getISTTime } from '../notifications/notifications.helpers.js';
import { emitEvent } from '../../events/index.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { logger } from '../../shared/logger/index.js';

export interface ReinstateAssignmentParams {
  reinstatedBy: string;
  reason: string;
  notes?: string;
  tx?: any;
}

export class ReinstatementService {
  static async reinstate(assignmentId: string, params: ReinstateAssignmentParams) {
    const runInTx = async (tx: any) => {
      const assignment = await tx.assignment.findUnique({
        where: { id: assignmentId },
        include: {
          campaign: true,
          driver: true,
          settlement: true,
        },
      });

      if (!assignment) {
        throw new AppError(ERROR_CODES.NOT_FOUND, 404, 'Assignment not found');
      }

      if (assignment.status !== ASSIGNMENT_STATUS.TERMINATED) {
        throw new AppError(
          ERROR_CODES.INVALID_STATE_TRANSITION,
          400,
          `Cannot reinstate assignment in status ${assignment.status}`,
        );
      }

      if (assignment.settlement && assignment.settlement.status === SETTLEMENT_STATUS.APPROVED) {
        throw new AppError(
          ERROR_CODES.REINSTATE_NOT_POSSIBLE,
          400,
          'Cannot reinstate assignment: settlement has already been approved',
        );
      }

      const campaign = assignment.campaign;
      if (
        campaign.status !== CAMPAIGN_STATUS.LIVE &&
        campaign.status !== CAMPAIGN_STATUS.RUNNING
      ) {
        throw new AppError(
          ERROR_CODES.REINSTATE_NOT_POSSIBLE,
          400,
          `Cannot reinstate assignment: campaign is in status ${campaign.status}`,
        );
      }

      // Check slot capacity
      if (campaign.enrolledCount >= campaign.targetAutoCount) {
        throw new AppError(
          ERROR_CODES.CAMPAIGN_SLOTS_FULL,
          400,
          'Cannot reinstate assignment: campaign slots are full',
        );
      }

      // State machine validation
      await assignmentStateMachine.assertTransition(
        ASSIGNMENT_STATUS.TERMINATED,
        ASSIGNMENT_STATUS.RUNNING,
      );

      const now = new Date();
      const { dateStr } = getISTTime(now);
      const todayDate = new Date(`${dateStr}T00:00:00.000Z`);

      // Fill gap days between termination date and today as EXCUSED
      const lastRecordedDay = await tx.assignmentDay.findFirst({
        where: { assignmentId },
        orderBy: { date: 'desc' },
      });

      const startDate = lastRecordedDay ? new Date(lastRecordedDay.date.getTime() + 86400000) : todayDate;
      const curDate = new Date(startDate);

      while (curDate <= todayDate) {
        const dayStr = curDate.toISOString().split('T')[0];
        await tx.assignmentDay.upsert({
          where: {
            assignmentId_date: {
              assignmentId,
              date: new Date(`${dayStr}T00:00:00.000Z`),
            },
          },
          create: {
            assignmentId,
            date: new Date(`${dayStr}T00:00:00.000Z`),
            status: 'EXCUSED',
            excuseNote: 'Assignment reinstated after appeal',
            excusedById: params.reinstatedBy,
          },
          update: {
            status: 'EXCUSED',
            excuseNote: 'Assignment reinstated after appeal',
            excusedById: params.reinstatedBy,
          },
        });
        curDate.setDate(curDate.getDate() + 1);
      }

      // Re-create remaining days up to campaign end date
      const campaignEndDate = campaign.endDate;
      const nextDay = new Date(todayDate.getTime() + 86400000);
      const futureDate = new Date(nextDay);

      while (futureDate <= campaignEndDate) {
        const dayStr = futureDate.toISOString().split('T')[0];
        await tx.assignmentDay.upsert({
          where: {
            assignmentId_date: {
              assignmentId,
              date: new Date(`${dayStr}T00:00:00.000Z`),
            },
          },
          create: {
            assignmentId,
            date: new Date(`${dayStr}T00:00:00.000Z`),
            status: 'PENDING',
          },
          update: {},
        });
        futureDate.setDate(futureDate.getDate() + 1);
      }

      // Recompute counters
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

      // Update assignment
      const updatedAssignment = await tx.assignment.update({
        where: { id: assignmentId },
        data: {
          status: ASSIGNMENT_STATUS.RUNNING,
          endedAt: null,
          terminatedAt: null,
          terminationDate: null,
          terminatedById: null,
          verifiedDays: verifiedCount,
          missedDays: missedCount,
          excusedDays: excusedCount,
        },
      });

      // Increment campaign active slots
      await tx.campaign.update({
        where: { id: campaign.id },
        data: {
          enrolledCount: {
            increment: 1,
          },
        },
      });

      // Audit Log
      await tx.auditLog.create({
        data: {
          actorId: params.reinstatedBy,
          actorType: 'USER',
          action: 'ASSIGNMENT_REINSTATED',
          entityType: 'ASSIGNMENT',
          entityId: assignmentId,
          oldValues: { status: ASSIGNMENT_STATUS.TERMINATED },
          newValues: {
            status: ASSIGNMENT_STATUS.RUNNING,
            reason: params.reason,
            notes: params.notes,
          },
        },
      });

      return {
        assignment: updatedAssignment,
        driverUserId: assignment.driverId,
        companyUserId: campaign.companyId,
        campaignTitle: campaign.title,
        campaignId: campaign.id,
        driverId: assignment.driverId,
      };
    };

    const res = params.tx ? await runInTx(params.tx) : await prisma.$transaction(runInTx);

    // Emit event
    emitEvent('assignment.reinstated', {
      assignmentId,
      campaignId: res.campaignId,
      driverId: res.driverId,
      reinstatedById: params.reinstatedBy,
      note: params.notes ?? params.reason,
    });

    // Notify driver
    NotificationsService.notify({
      key: 'assignment.reinstated',
      userId: res.driverUserId,
      data: {
        title: res.campaignTitle,
      },
    }).catch((err) => {
      logger.error({ err, assignmentId }, '[ReinstatementService] Failed to notify driver');
    });

    return res.assignment;
  }
}
