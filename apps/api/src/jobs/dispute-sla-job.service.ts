import { prisma } from '../shared/db/index.js';
import { DISPUTE_STATUS, ROLES } from '@ap/shared-constants';
import { NotificationsService } from '../modules/notifications/notifications.service.js';
import { emitEvent } from '../events/index.js';
import { logger } from '../shared/logger/index.js';

export class DisputeSlaJobService {
  /**
   * Hourly job: checks disputes approaching or breaching SLA resolution deadline
   */
  static async processDisputeSla(): Promise<number> {
    const now = new Date();
    const breachedDisputes = await prisma.dispute.findMany({
      where: {
        status: { in: [DISPUTE_STATUS.OPEN, DISPUTE_STATUS.UNDER_REVIEW] },
        slaDueAt: { lte: now },
        escalatedAt: null,
      },
    });

    if (breachedDisputes.length === 0) {
      return 0;
    }

    // Find super admins to notify
    const superAdmins = await prisma.user.findMany({
      where: { role: ROLES.SUPER_ADMIN },
      select: { id: true },
    });

    let count = 0;
    for (const dispute of breachedDisputes) {
      try {
        await prisma.dispute.update({
          where: { id: dispute.id },
          data: { escalatedAt: now },
        });

        await prisma.disputeEvent.create({
          data: {
            disputeId: dispute.id,
            type: 'SLA_ESCALATED',
            data: { breachedAt: now.toISOString(), slaDueAt: dispute.slaDueAt?.toISOString() },
          },
        });

        emitEvent('dispute.escalated', {
          disputeId: dispute.id,
          slaDueAt: dispute.slaDueAt ?? now,
          assignedToId: dispute.assignedToId,
        });

        for (const admin of superAdmins) {
          NotificationsService.notify({
            key: 'dispute.escalated',
            userId: admin.id,
            data: {
              disputeId: dispute.id,
              slaDeadline: dispute.slaDueAt?.toLocaleDateString('en-IN') ?? 'Immediate',
            },
          }).catch(() => null);
        }

        count++;
      } catch (err) {
        logger.error({ err, disputeId: dispute.id }, '[DisputeSlaJob] Failed to escalate dispute');
      }
    }

    logger.info({ escalatedDisputes: count }, '[DisputeSlaJob] Processed dispute SLA checks');
    return count;
  }
}
