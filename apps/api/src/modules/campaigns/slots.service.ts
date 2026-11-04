import { prisma } from '../../shared/db/index.js';
import {
  ASSIGNMENT_STATUS,
  CAMPAIGN_STATUS,
  type AssignmentStatus,
} from '@ap/shared-constants';
import type { Prisma, Campaign } from '@prisma/client';

export const NON_OCCUPYING_ASSIGNMENT_STATUSES: readonly AssignmentStatus[] = [
  ASSIGNMENT_STATUS.RESERVATION_EXPIRED,
  ASSIGNMENT_STATUS.TERMINATED,
] as const;

export interface SlotUsage {
  total: number;
  occupied: number;
  available: number;
}

export class SlotsService {
  /**
   * Calculates slot usage for a given campaign.
   */
  static async getSlotUsage(
    campaignId: string,
    tx: Prisma.TransactionClient = prisma,
  ): Promise<SlotUsage> {
    const campaign = await tx.campaign.findUnique({
      where: { id: campaignId },
      select: { targetAutoCount: true },
    });

    if (!campaign) {
      throw new Error(`Campaign ${campaignId} not found`);
    }

    const occupied = await tx.assignment.count({
      where: {
        campaignId,
        status: {
          notIn: NON_OCCUPYING_ASSIGNMENT_STATUSES as AssignmentStatus[],
        },
      },
    });

    const total = campaign.targetAutoCount;
    const available = Math.max(0, total - occupied);

    return { total, occupied, available };
  }

  /**
   * Acquires a row lock on the campaign record inside a transaction (SELECT ... FOR UPDATE)
   * and calculates slot usage, ensuring safe concurrent reservations without overbooking.
   */
  static async lockCampaignForSlotChange(
    tx: Prisma.TransactionClient,
    campaignId: string,
  ): Promise<SlotUsage> {
    const rows = await tx.$queryRaw<Array<{ id: string; target_auto_count: number }>>`
      SELECT id, target_auto_count FROM campaigns WHERE id = ${campaignId}::uuid FOR UPDATE
    `;

    if (!rows || rows.length === 0 || !rows[0]) {
      throw new Error(`Campaign ${campaignId} not found`);
    }

    const total = rows[0].target_auto_count;

    const occupied = await tx.assignment.count({
      where: {
        campaignId,
        status: {
          notIn: NON_OCCUPYING_ASSIGNMENT_STATUSES as AssignmentStatus[],
        },
      },
    });

    const available = Math.max(0, total - occupied);
    return { total, occupied, available };
  }

  /**
   * Evaluates if enrolment is currently open for the campaign.
   * Enrolment is open when campaign is LIVE or RUNNING and current time has not passed enrolmentClosesAt.
   */
  static isEnrolmentOpen(
    campaign: Pick<Campaign, 'status' | 'enrolmentClosesAt' | 'endDate'>,
    now: Date = new Date(),
  ): boolean {
    if (
      campaign.status !== CAMPAIGN_STATUS.LIVE &&
      campaign.status !== CAMPAIGN_STATUS.RUNNING
    ) {
      return false;
    }

    if (campaign.enrolmentClosesAt && now > campaign.enrolmentClosesAt) {
      return false;
    }

    if (now > campaign.endDate) {
      return false;
    }

    return true;
  }
}
