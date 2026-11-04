import { prisma } from '../../shared/db/index.js';
import {
  DAY_STATUS,
  SETTING_KEYS,
  ERROR_CODES,
  ACTOR_TYPES,
  type DayStatus,
} from '@ap/shared-constants';
import { AppError } from '../../shared/errors/index.js';
import {
  TimeService,
  addDaysIST,
  diffDaysIST,
  toISTDate,
  todayIST,
} from '../../shared/time/index.js';
import { SettingsService } from '../settings/settings.service.js';
import { AuditService } from '../audit/audit.service.js';
import { eventBus } from '../../events/index.js';
import {
  calculateWindowRent,
  estimateRentSoFar,
  projectFinalRent,
  isDayCutoffPassed,
} from './assignment-days.math.js';
import type { AssignmentDaysSummaryDto, AssignmentDayDto } from '@ap/shared-types';

export class AssignmentDaysService {
  /**
   * Helper: Resolves assignment run dates [runStartDate, runEndDate] in IST format (YYYY-MM-DD).
   */
  static getAssignmentRunDates(assignment: {
    installedAt?: Date | null;
    installApprovedAt?: Date | null;
    startedAt?: Date | null;
    campaign: {
      startDate: Date;
      endDate: Date;
    };
  }): { runStartDate: string; runEndDate: string; windowDays: number } {
    const campaignStartDateIST = toISTDate(assignment.campaign.startDate);
    const campaignEndDateIST = toISTDate(assignment.campaign.endDate);

    let approvalDateIST = campaignStartDateIST;
    if (assignment.installApprovedAt) {
      approvalDateIST = toISTDate(assignment.installApprovedAt);
    } else if (assignment.installedAt) {
      approvalDateIST = toISTDate(assignment.installedAt);
    }

    const runStartDate = approvalDateIST > campaignStartDateIST ? approvalDateIST : campaignStartDateIST;
    const runEndDate = campaignEndDateIST;
    const windowDays = Math.max(1, diffDaysIST(runStartDate, runEndDate));

    return { runStartDate, runEndDate, windowDays };
  }

  /**
   * Idempotently creates AssignmentDay rows for all dates from runStartDate up to upToDateIST.
   */
  static async ensureDayRows(
    assignmentId: string,
    upToDateIST?: string,
  ): Promise<number> {
    const assignment = await prisma.assignment.findUnique({
      where: { id: assignmentId },
      include: { campaign: true },
    });

    if (!assignment) {
      throw new AppError(ERROR_CODES.ASSIGNMENT_NOT_FOUND, 404, 'Assignment not found');
    }

    const { runStartDate, runEndDate } = this.getAssignmentRunDates(assignment);
    const targetDate = upToDateIST ?? todayIST();
    const effectiveEndDate = targetDate < runEndDate ? targetDate : runEndDate;

    if (runStartDate > effectiveEndDate) {
      return 0;
    }

    // Generate list of IST dates
    const totalDaysToCreate = diffDaysIST(runStartDate, effectiveEndDate);
    const dateList: string[] = [];
    for (let i = 0; i < totalDaysToCreate; i++) {
      dateList.push(addDaysIST(runStartDate, i));
    }

    // Fetch existing days
    const existingDays = await prisma.assignmentDay.findMany({
      where: {
        assignmentId,
        date: {
          gte: new Date(`${runStartDate}T00:00:00.000Z`),
          lte: new Date(`${effectiveEndDate}T23:59:59.999Z`),
        },
      },
      select: { date: true },
    });

    const existingDateSet = new Set(existingDays.map((d) => toISTDate(d.date)));
    const missingDates = dateList.filter((d) => !existingDateSet.has(d));

    if (missingDates.length === 0) {
      return 0;
    }

    await prisma.assignmentDay.createMany({
      data: missingDates.map((d) => ({
        assignmentId,
        date: new Date(`${d}T00:00:00.000Z`),
        status: DAY_STATUS.PENDING,
      })),
      skipDuplicates: true,
    });

    return missingDates.length;
  }

  /**
   * Recalculates verifiedDays, missedDays, and excusedDays on the Assignment record.
   */
  static async recomputeCounters(assignmentId: string): Promise<{
    verifiedDays: number;
    missedDays: number;
    excusedDays: number;
  }> {
    const days = await prisma.assignmentDay.findMany({
      where: { assignmentId },
      select: { status: true },
    });

    let verifiedDays = 0;
    let missedDays = 0;
    let excusedDays = 0;

    for (const d of days) {
      if (d.status === DAY_STATUS.VERIFIED) verifiedDays++;
      else if (d.status === DAY_STATUS.MISSED) missedDays++;
      else if (d.status === DAY_STATUS.EXCUSED) excusedDays++;
    }

    await prisma.assignment.update({
      where: { id: assignmentId },
      data: {
        verifiedDays,
        missedDays,
        excusedDays,
      },
    });

    return { verifiedDays, missedDays, excusedDays };
  }

  /**
   * Returns count and details of days that are PENDING or UNDER_REVIEW.
   * Phase 8 settlement gate blocks if any unresolved days exist.
   */
  static async getUnresolvedDays(assignmentId: string): Promise<{
    count: number;
    pendingCount: number;
    underReviewCount: number;
    days: Array<{ id: string; date: string; status: DayStatus }>;
  }> {
    const unresolved = await prisma.assignmentDay.findMany({
      where: {
        assignmentId,
        status: { in: [DAY_STATUS.PENDING, DAY_STATUS.UNDER_REVIEW] },
      },
      orderBy: { date: 'asc' },
    });

    let pendingCount = 0;
    let underReviewCount = 0;
    for (const d of unresolved) {
      if (d.status === DAY_STATUS.PENDING) pendingCount++;
      else if (d.status === DAY_STATUS.UNDER_REVIEW) underReviewCount++;
    }

    return {
      count: unresolved.length,
      pendingCount,
      underReviewCount,
      days: unresolved.map((d) => ({
        id: d.id,
        date: toISTDate(d.date),
        status: d.status as DayStatus,
      })),
    };
  }

  /**
   * Excuses a MISSED or PENDING day on an assignment (permission: assignment.manage).
   * Excused days count toward payable days.
   */
  static async excuseDay(
    assignmentId: string,
    dateStr: string,
    reason: string,
    adminUserId: string,
  ): Promise<AssignmentDayDto> {
    const dateUtc = new Date(`${dateStr}T00:00:00.000Z`);

    const day = await prisma.assignmentDay.findUnique({
      where: {
        assignmentId_date: {
          assignmentId,
          date: dateUtc,
        },
      },
      include: {
        assignment: {
          include: { campaign: true },
        },
      },
    });

    if (!day) {
      throw new AppError(ERROR_CODES.NOT_FOUND, 404, `Assignment day for date ${dateStr} not found`);
    }

    if (day.status === DAY_STATUS.VERIFIED) {
      throw new AppError(
        ERROR_CODES.DAY_NOT_EXCUSABLE,
        400,
        'Cannot excuse a day that has already been verified with photo proof',
      );
    }

    const now = TimeService.now();
    const updated = await prisma.assignmentDay.update({
      where: { id: day.id },
      data: {
        status: DAY_STATUS.EXCUSED,
        excusedById: adminUserId,
        excuseNote: reason,
        statusChangedAt: now,
      },
    });

    await this.recomputeCounters(assignmentId);

    await AuditService.log({
      actorId: adminUserId,
      actorType: ACTOR_TYPES.USER,
      action: 'assignment.day_excused',
      entityType: 'AssignmentDay',
      entityId: day.id,
      newValues: {
        assignmentId,
        date: dateStr,
        reason,
        previousStatus: day.status,
      },
    });

    eventBus.emit('assignment.day_excused', {
      assignmentId,
      driverId: day.assignment.driverId,
      date: dateStr,
      excusedById: adminUserId,
      note: reason,
    });

    return {
      id: updated.id,
      assignmentId: updated.assignmentId,
      date: dateStr,
      status: DAY_STATUS.EXCUSED,
      verifiedPhotoId: updated.verifiedPhotoId,
      excusedById: updated.excusedById,
      excuseNote: updated.excuseNote,
      statusChangedAt: updated.statusChangedAt?.toISOString() ?? null,
    };
  }

  /**
   * Finalizes an assignment at campaign completion:
   * Closes all remaining PENDING days as MISSED, recomputes counters, and emits assignment.days_finalized.
   */
  static async finalizeAssignmentDays(assignmentId: string): Promise<{
    payableDays: number;
    missedDays: number;
    excusedDays: number;
  }> {
    const now = TimeService.now();

    // Mark all remaining PENDING days as MISSED
    await prisma.assignmentDay.updateMany({
      where: {
        assignmentId,
        status: DAY_STATUS.PENDING,
      },
      data: {
        status: DAY_STATUS.MISSED,
        statusChangedAt: now,
      },
    });

    const counters = await this.recomputeCounters(assignmentId);
    const payableDays = counters.verifiedDays + counters.excusedDays;

    eventBus.emit('assignment.days_finalized', {
      assignmentId,
      payableDays,
      missedDays: counters.missedDays,
      excusedDays: counters.excusedDays,
    });

    return {
      payableDays,
      missedDays: counters.missedDays,
      excusedDays: counters.excusedDays,
    };
  }

  /**
   * Daily rollover job processor (runs every 15 min):
   * 1. Ensures day rows for all RUNNING assignments.
   * 2. Closes PENDING days past their cutoff as MISSED.
   * 3. Emits assignment.day_missed once per day.
   */
  static async processDailyDayRoll(nowUtc: Date = TimeService.now()): Promise<{
    processedAssignments: number;
    newlyMissedDays: number;
  }> {
    const runningAssignments = await prisma.assignment.findMany({
      where: { status: 'RUNNING' },
      include: { campaign: true },
    });

    const lateGraceHours = await SettingsService.get(SETTING_KEYS.DAILY_PHOTO_LATE_GRACE_HOURS).catch(() => 12);

    let newlyMissedDays = 0;

    for (const assignment of runningAssignments) {
      await this.ensureDayRows(assignment.id);

      // Find PENDING days
      const pendingDays = await prisma.assignmentDay.findMany({
        where: {
          assignmentId: assignment.id,
          status: DAY_STATUS.PENDING,
        },
      });

      let changed = false;
      for (const day of pendingDays) {
        const istDateStr = toISTDate(day.date);
        if (isDayCutoffPassed(istDateStr, nowUtc, lateGraceHours)) {
          await prisma.assignmentDay.update({
            where: { id: day.id },
            data: {
              status: DAY_STATUS.MISSED,
              statusChangedAt: nowUtc,
            },
          });

          changed = true;
          newlyMissedDays++;

          const updatedCounters = await this.recomputeCounters(assignment.id);

          eventBus.emit('assignment.day_missed', {
            assignmentId: assignment.id,
            driverId: assignment.driverId,
            date: istDateStr,
            missedDaysCount: updatedCounters.missedDays,
          });
        }
      }

      if (changed) {
        await this.recomputeCounters(assignment.id);
      }
    }

    return {
      processedAssignments: runningAssignments.length,
      newlyMissedDays,
    };
  }

  /**
   * Retrieves summary of all days, counters, grace status, and rent estimates for an assignment.
   */
  static async getDaysSummary(assignmentId: string): Promise<AssignmentDaysSummaryDto> {
    const assignment = await prisma.assignment.findUnique({
      where: { id: assignmentId },
      include: {
        campaign: true,
        days: {
          orderBy: { date: 'asc' },
          include: { verifiedPhoto: true },
        },
      },
    });

    if (!assignment) {
      throw new AppError(ERROR_CODES.ASSIGNMENT_NOT_FOUND, 404, 'Assignment not found');
    }

    const { windowDays } = this.getAssignmentRunDates(assignment);
    const graceDays = await SettingsService.get(SETTING_KEYS.GRACE_DAYS).catch(() => 3);

    const verifiedDays = assignment.verifiedDays;
    const missedDays = assignment.missedDays;
    const excusedDays = assignment.excusedDays;
    const payableDays = verifiedDays + excusedDays;

    let pendingDays = 0;
    for (const d of assignment.days) {
      if (d.status === DAY_STATUS.PENDING || d.status === DAY_STATUS.UNDER_REVIEW) {
        pendingDays++;
      }
    }

    const graceDaysRemaining = Math.max(0, graceDays - missedDays);

    const rentPer30DaysPaise = Number(assignment.campaign.dailyRentPaise) * 30;
    const windowRentPaise = calculateWindowRent(rentPer30DaysPaise, windowDays);

    const earnedRentPaiseEstimate = estimateRentSoFar(windowRentPaise, windowDays, payableDays);
    const projectedFinalRentPaise = projectFinalRent(windowRentPaise, windowDays, missedDays, graceDays);

    const dayDtos: AssignmentDayDto[] = assignment.days.map((d) => ({
      id: d.id,
      assignmentId: d.assignmentId,
      date: toISTDate(d.date),
      status: d.status as DayStatus,
      verifiedPhotoId: d.verifiedPhotoId,
      verifiedPhotoThumbnailUrl: d.verifiedPhoto?.thumbnailUrl ?? d.verifiedPhoto?.photoUrl ?? null,
      reasonCode: d.reasonCode,
      excusedById: d.excusedById,
      excuseNote: d.excuseNote,
      statusChangedAt: d.statusChangedAt?.toISOString() ?? null,
    }));

    return {
      days: dayDtos,
      totalDays: windowDays,
      verifiedDays,
      missedDays,
      excusedDays,
      pendingDays,
      payableDays,
      graceDaysAllowed: graceDays,
      graceDaysRemaining,
      earnedRentPaiseEstimate,
      projectedFinalRentPaise,
    };
  }
}

