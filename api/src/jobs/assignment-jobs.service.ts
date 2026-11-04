import { prisma } from '../shared/db/index.js';
import {
  ASSIGNMENT_STATUS,
  ASSIGNMENT_RELEASE_REASONS,
  ACTOR_TYPES,
  SETTING_KEYS,
  CAMPAIGN_STATUS,
} from '@ap/shared-constants';
import { assignmentStateMachine } from '../modules/assignments/assignments.state-machine.js';
import { AuditService } from '../modules/audit/audit.service.js';
import { eventBus } from '../events/index.js';
import {
  TimeService,
  todayIST,
  startOfISTDay,
  endOfISTDay,
} from '../shared/time/index.js';
import { SettingsService } from '../modules/settings/settings.service.js';
import { AssignmentDaysService } from '../modules/assignment-days/assignment-days.service.js';
import { logger } from '../shared/logger/index.js';

export class AssignmentJobsService {
  /**
   * 1. assignment-reservation-expiry:
   * Transitions RESERVED assignments whose expiresAt has passed to RESERVATION_EXPIRED.
   */
  static async processReservationExpiry(): Promise<number> {
    const now = TimeService.now();
    const expiredAssignments = await prisma.assignment.findMany({
      where: {
        status: ASSIGNMENT_STATUS.RESERVED,
        expiresAt: { lt: now },
      },
      select: {
        id: true,
        campaignId: true,
        driverId: true,
        vehicleId: true,
      },
    });

    let count = 0;
    for (const assignment of expiredAssignments) {
      await assignmentStateMachine.assertTransition(
        ASSIGNMENT_STATUS.RESERVED,
        ASSIGNMENT_STATUS.RESERVATION_EXPIRED,
      );

      const updateResult = await prisma.assignment.updateMany({
        where: {
          id: assignment.id,
          status: ASSIGNMENT_STATUS.RESERVED,
        },
        data: {
          status: ASSIGNMENT_STATUS.RESERVATION_EXPIRED,
          releaseReason: ASSIGNMENT_RELEASE_REASONS.RESERVATION_TIMEOUT,
          releasedAt: now,
        },
      });

      if (updateResult.count > 0) {
        count++;
        await AuditService.log({
          actorId: null,
          actorType: ACTOR_TYPES.SYSTEM,
          action: 'assignment.reservation_expired',
          entityType: 'Assignment',
          entityId: assignment.id,
          newValues: {
            status: ASSIGNMENT_STATUS.RESERVATION_EXPIRED,
            expiredAt: now.toISOString(),
          },
        });

        eventBus.emit('assignment.reservation_expired', {
          assignmentId: assignment.id,
          campaignId: assignment.campaignId,
          driverId: assignment.driverId,
          vehicleId: assignment.vehicleId,
          expiredAt: now,
        });
      }
    }

    if (count > 0) {
      logger.info({ count }, 'assignment-reservation-expiry job: expired reservations');
    }
    return count;
  }

  /**
   * 2. assignment-reservation-reminder:
   * Sends warnings to drivers whose reservation expires within 12 hours and 2 hours.
   */
  static async processReservationReminder(): Promise<number> {
    const now = TimeService.now();
    const in12Hours = new Date(now.getTime() + 12 * 3600 * 1000);

    const pendingReminders = await prisma.assignment.findMany({
      where: {
        status: ASSIGNMENT_STATUS.RESERVED,
        expiresAt: {
          gt: now,
          lte: in12Hours,
        },
      },
      include: {
        campaign: true,
        driver: true,
      },
    });

    for (const assignment of pendingReminders) {
      const remainingHours = Math.max(1, Math.round((assignment.expiresAt.getTime() - now.getTime()) / (3600 * 1000)));

      eventBus.emit('assignment.reservation_reminder', {
        assignmentId: assignment.id,
        campaignId: assignment.campaignId,
        driverId: assignment.driverId,
        driverMobile: assignment.driver.mobile,
        remainingHours,
        expiresAt: assignment.expiresAt,
      });
    }

    return pendingReminders.length;
  }

  /**
   * 3. assignment-installation-escalation:
   * Escalates company reviews that exceed SLA (e.g. 24h) to the PLATFORM team.
   */
  static async processInstallationEscalation(): Promise<number> {
    const slaHours = await SettingsService.get(SETTING_KEYS.COMPANY_INSTALL_REVIEW_SLA_HOURS).catch(() => 24);
    const now = TimeService.now();
    const overdueCutoff = new Date(now.getTime() - slaHours * 3600 * 1000);

    const overdue = await prisma.assignment.findMany({
      where: {
        status: ASSIGNMENT_STATUS.INSTALL_SUBMITTED,
        reviewOwner: 'COMPANY',
        installedAt: { lte: overdueCutoff },
      },
      select: {
        id: true,
        campaignId: true,
        driverId: true,
      },
    });

    let count = 0;
    for (const assignment of overdue) {
      const updateResult = await prisma.assignment.updateMany({
        where: {
          id: assignment.id,
          status: ASSIGNMENT_STATUS.INSTALL_SUBMITTED,
          reviewOwner: 'COMPANY',
        },
        data: {
          reviewOwner: 'PLATFORM',
          escalatedAt: now,
        },
      });

      if (updateResult.count > 0) {
        count++;
        await AuditService.log({
          actorId: null,
          actorType: ACTOR_TYPES.SYSTEM,
          action: 'assignment.review_escalated',
          entityType: 'Assignment',
          entityId: assignment.id,
          newValues: {
            reviewOwner: 'PLATFORM',
            escalatedAt: now.toISOString(),
            reason: `Company review exceeded ${slaHours}h SLA`,
          },
        });

        eventBus.emit('assignment.review_escalated', {
          assignmentId: assignment.id,
          campaignId: assignment.campaignId,
          escalatedAt: now,
        });
      }
    }

    if (count > 0) {
      logger.info({ count }, 'assignment-installation-escalation job: escalated overdue reviews');
    }
    return count;
  }

  /**
   * 4. assignment-start:
   * Transitions INSTALL_APPROVED assignments whose campaign startDate (in IST) <= today (IST) to RUNNING.
   */
  static async processAssignmentStart(): Promise<number> {
    const today = todayIST();
    const endOfToday = endOfISTDay(today);

    const readyAssignments = await prisma.assignment.findMany({
      where: {
        status: ASSIGNMENT_STATUS.INSTALL_APPROVED,
        campaign: {
          status: { in: [CAMPAIGN_STATUS.LIVE, CAMPAIGN_STATUS.RUNNING] },
          startDate: { lte: endOfToday },
        },
      },
      select: {
        id: true,
        campaignId: true,
        driverId: true,
      },
    });

    let count = 0;
    const now = TimeService.now();
    for (const assignment of readyAssignments) {
      await assignmentStateMachine.assertTransition(
        ASSIGNMENT_STATUS.INSTALL_APPROVED,
        ASSIGNMENT_STATUS.RUNNING,
      );

      const updateResult = await prisma.assignment.updateMany({
        where: {
          id: assignment.id,
          status: ASSIGNMENT_STATUS.INSTALL_APPROVED,
        },
        data: {
          status: ASSIGNMENT_STATUS.RUNNING,
          startedAt: now,
        },
      });

      if (updateResult.count > 0) {
        count++;
        await AuditService.log({
          actorId: null,
          actorType: ACTOR_TYPES.SYSTEM,
          action: 'assignment.started',
          entityType: 'Assignment',
          entityId: assignment.id,
          newValues: { status: ASSIGNMENT_STATUS.RUNNING, startedAt: now.toISOString() },
        });

        eventBus.emit('assignment.running', {
          assignmentId: assignment.id,
          campaignId: assignment.campaignId,
          driverId: assignment.driverId,
          startedAt: now,
        });
      }
    }

    if (count > 0) {
      logger.info({ count }, 'assignment-start job: started assignments');
    }
    return count;
  }

  /**
   * 5. assignment-complete:
   * Transitions RUNNING assignments whose campaign has ended (endDate in IST < today IST or campaign COMPLETED) to COMPLETED.
   */
  static async processAssignmentComplete(): Promise<number> {
    const today = todayIST();
    const startOfToday = startOfISTDay(today);

    const completedAssignments = await prisma.assignment.findMany({
      where: {
        status: ASSIGNMENT_STATUS.RUNNING,
        OR: [
          { campaign: { status: CAMPAIGN_STATUS.COMPLETED } },
          { campaign: { endDate: { lt: startOfToday } } },
        ],
      },
      select: {
        id: true,
        campaignId: true,
        driverId: true,
      },
    });

    let count = 0;
    const now = TimeService.now();
    for (const assignment of completedAssignments) {
      // Phase 7 Completion Gate: Check unresolved days
      const unresolvedDays = await AssignmentDaysService.getUnresolvedDays(assignment.id);
      if (unresolvedDays.count > 0) {
        logger.info(
          { assignmentId: assignment.id, unresolvedCount: unresolvedDays.count },
          'assignment-complete job: cannot complete assignment yet, unresolved days exist',
        );
        continue;
      }

      // Finalize assignment days
      await AssignmentDaysService.finalizeAssignmentDays(assignment.id);

      await assignmentStateMachine.assertTransition(
        ASSIGNMENT_STATUS.RUNNING,
        ASSIGNMENT_STATUS.COMPLETED,
      );

      const updateResult = await prisma.assignment.updateMany({
        where: {
          id: assignment.id,
          status: ASSIGNMENT_STATUS.RUNNING,
        },
        data: {
          status: ASSIGNMENT_STATUS.COMPLETED,
          endedAt: now,
        },
      });

      if (updateResult.count > 0) {
        count++;
        await AuditService.log({
          actorId: null,
          actorType: ACTOR_TYPES.SYSTEM,
          action: 'assignment.completed',
          entityType: 'Assignment',
          entityId: assignment.id,
          newValues: { status: ASSIGNMENT_STATUS.COMPLETED, completedAt: now.toISOString() },
        });

        eventBus.emit('assignment.completed', {
          assignmentId: assignment.id,
          campaignId: assignment.campaignId,
          driverId: assignment.driverId,
          completedAt: now,
        });
      }
    }

    if (count > 0) {
      logger.info({ count }, 'assignment-complete job: completed assignments');
    }
    return count;
  }
}

