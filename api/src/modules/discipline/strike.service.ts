import { prisma } from '../../shared/db/index.js';
import {
  STRIKE_STATUS,
  STRIKE_SOURCE,
  BAN_TYPES,
  SETTING_KEYS,
  ASSIGNMENT_STATUS,
  ERROR_CODES,
  type StrikeStatus,
  type StrikeReason,
  type StrikeSource,
} from '@ap/shared-constants';
import { AppError } from '../../shared/errors/app-error.js';
import { strikeStateMachine } from './strikes.state-machine.js';
import { TerminationService } from './termination.service.js';
import { SettingsService } from '../settings/settings.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { emitEvent } from '../../events/index.js';
import { logger } from '../../shared/logger/index.js';

export interface IssueStrikeParams {
  driverId: string; // User.id
  reason: StrikeReason;
  source?: StrikeSource;
  assignmentId?: string;
  photoId?: string;
  dayDate?: Date;
  notes?: string;
  issuedByUserId?: string;
  dedupeKey?: string;
  tx?: any;
}

export class StrikeService {
  static async issue(params: IssueStrikeParams) {
    if (params.dedupeKey) {
      const existing = await prisma.strike.findUnique({
        where: { dedupeKey: params.dedupeKey },
      });
      if (existing) {
        logger.debug({ dedupeKey: params.dedupeKey }, '[StrikeService] Dedupe key hit, returning existing strike');
        return existing;
      }
    }

    const validityDays = await SettingsService.get(
      SETTING_KEYS.STRIKE_EXPIRY_DAYS,
      90,
    );

    const now = new Date();
    const expiresAt = new Date(now.getTime() + validityDays * 24 * 60 * 60 * 1000);

    const runInTx = async (tx: any) => {
      const strike = await tx.strike.create({
        data: {
          driverId: params.driverId,
          reason: params.reason as any,
          status: STRIKE_STATUS.ACTIVE as any,
          source: (params.source ?? STRIKE_SOURCE.AUTO_RULE) as any,
          notes: params.notes,
          issuedByUserId: params.issuedByUserId,
          expiresAt,
          assignmentId: params.assignmentId,
          photoId: params.photoId,
          dayDate: params.dayDate,
          dedupeKey: params.dedupeKey,
        },
      });

      // Increment strikes count on driver profile
      await tx.driverProfile.updateMany({
        where: { userId: params.driverId },
        data: { strikesCount: { increment: 1 } },
      });

      // Audit log
      await tx.auditLog.create({
        data: {
          actorId: params.issuedByUserId,
          actorType: params.issuedByUserId ? 'USER' : 'SYSTEM',
          action: 'STRIKE_ISSUED',
          entityType: 'STRIKE',
          entityId: strike.id,
          newValues: {
            driverId: params.driverId,
            reason: params.reason,
            source: params.source ?? STRIKE_SOURCE.AUTO_RULE,
            notes: params.notes,
            expiresAt,
          },
        },
      });

      // Check ladder
      await this.evaluateLadder(params.driverId, tx);

      return strike;
    };

    const strike = params.tx ? await runInTx(params.tx) : await prisma.$transaction(runInTx);

    // Emit event
    emitEvent('strike.issued', {
      strikeId: strike.id,
      driverId: params.driverId,
      assignmentId: params.assignmentId ?? null,
      reason: params.reason,
      notes: params.notes ?? null,
      expiresAt,
    });

    // Notify driver
    const appealDays = 7;
    const appealDeadline = new Date(now.getTime() + appealDays * 24 * 60 * 60 * 1000);

    NotificationsService.notify({
      key: 'strike.issued',
      userId: params.driverId,
      data: {
        reason: params.reason,
        strikeId: strike.id,
        appealDeadline: appealDeadline.toLocaleDateString('en-IN'),
      },
    }).catch((err) => {
      logger.error({ err, strikeId: strike.id }, '[StrikeService] Failed to notify driver of strike');
    });

    return strike;
  }

  static async evaluateLadder(driverUserId: string, tx: any) {
    const strikeLimit = await SettingsService.get(
      SETTING_KEYS.STRIKE_LIMIT,
      3,
    );

    const banDurationDays = await SettingsService.get(
      SETTING_KEYS.BAN_DAYS,
      90,
    );

    const now = new Date();
    const activeStrikes = await tx.strike.findMany({
      where: {
        driverId: driverUserId,
        status: STRIKE_STATUS.ACTIVE,
        expiresAt: { gt: now },
      },
    });

    if (activeStrikes.length < strikeLimit) {
      return null;
    }

    logger.info(
      { driverUserId, count: activeStrikes.length, strikeLimit },
      '[StrikeService] Driver reached strike limit, executing ban & terminations',
    );

    const endsAt = new Date(now.getTime() + banDurationDays * 24 * 60 * 60 * 1000);
    const strikeIds = activeStrikes.map((s: any) => s.id);

    // 1. Create DriverBan
    const ban = await tx.driverBan.create({
      data: {
        driverId: driverUserId,
        type: BAN_TYPES.TEMPORARY as any,
        startsAt: now,
        endsAt,
        reason: `${strikeLimit} active strikes accumulated`,
        strikeIds,
      },
    });

    // 2. Mark active strikes as CONSUMED and attach banId
    await tx.strike.updateMany({
      where: { id: { in: strikeIds } },
      data: {
        status: STRIKE_STATUS.CONSUMED as any,
        banId: ban.id,
      },
    });

    // 3. Set bannedUntil on driver profile
    await tx.driverProfile.updateMany({
      where: { userId: driverUserId },
      data: { bannedUntil: endsAt },
    });

    // 4. Terminate active assignments
    const activeAssignments = await tx.assignment.findMany({
      where: {
        driverId: driverUserId,
        status: {
          in: [
            ASSIGNMENT_STATUS.RESERVED,
            ASSIGNMENT_STATUS.INSTALLING,
            ASSIGNMENT_STATUS.INSTALL_SUBMITTED,
            ASSIGNMENT_STATUS.INSTALL_APPROVED,
            ASSIGNMENT_STATUS.RUNNING,
          ],
        },
      },
    });

    for (const assignment of activeAssignments) {
      await TerminationService.terminate(assignment.id, {
        reason: 'STRIKE_LIMIT',
        notes: `Automated ban triggered by ${strikeLimit} strikes`,
        tx,
      });
    }

    // 5. Audit Log
    await tx.auditLog.create({
      data: {
        actorType: 'SYSTEM',
        action: 'DRIVER_BANNED',
        entityType: 'DRIVER_BAN',
        entityId: ban.id,
        newValues: {
          driverId: driverUserId,
          type: BAN_TYPES.TEMPORARY,
          endsAt,
          strikesCount: strikeIds.length,
        },
      },
    });

    // 6. Emit event
    emitEvent('ban.started', {
      banId: ban.id,
      driverId: driverUserId,
      type: BAN_TYPES.TEMPORARY,
      endsAt,
      reason: `${strikeLimit} active strikes accumulated`,
    });

    // 7. Notify driver
    NotificationsService.notify({
      key: 'ban.started',
      userId: driverUserId,
      data: {
        reason: `${strikeLimit} active strikes accumulated`,
        endsAt: endsAt.toLocaleDateString('en-IN'),
      },
    }).catch((err) => {
      logger.error({ err, banId: ban.id }, '[StrikeService] Failed to notify driver of ban');
    });

    return ban;
  }

  static async revoke(
    strikeId: string,
    params: { revokedBy: string; reason: string; tx?: any },
  ) {
    const runInTx = async (tx: any) => {
      const strike = await tx.strike.findUnique({
        where: { id: strikeId },
        include: { ban: true },
      });

      if (!strike) {
        throw new AppError(ERROR_CODES.NOT_FOUND, 404, 'Strike not found');
      }

      // Check transition
      await strikeStateMachine.assertTransition(strike.status as StrikeStatus, STRIKE_STATUS.REVOKED);

      const now = new Date();
      const updatedStrike = await tx.strike.update({
        where: { id: strikeId },
        data: {
          status: STRIKE_STATUS.REVOKED as any,
          revokedAt: now,
          revokedById: params.revokedBy,
          revokeReason: params.reason,
        },
      });

      // Decrement driver profile strikesCount
      await tx.driverProfile.updateMany({
        where: { userId: strike.driverId },
        data: { strikesCount: { decrement: 1 } },
      });

      // Audit Log
      await tx.auditLog.create({
        data: {
          actorId: params.revokedBy,
          actorType: 'USER',
          action: 'STRIKE_REVOKED',
          entityType: 'STRIKE',
          entityId: strikeId,
          oldValues: { status: strike.status },
          newValues: {
            status: STRIKE_STATUS.REVOKED,
            reason: params.reason,
          },
        },
      });

      // If the strike was linked to a ban, check if ban should be lifted
      if (strike.banId && strike.ban && !strike.ban.liftedAt) {
        const remainingConsumedStrikes = await tx.strike.count({
          where: {
            banId: strike.banId,
            status: STRIKE_STATUS.CONSUMED,
          },
        });

        const strikeLimit = await SettingsService.get(
          SETTING_KEYS.STRIKE_LIMIT,
          3,
        );

        if (remainingConsumedStrikes < strikeLimit) {
          logger.info(
            { banId: strike.banId, remainingConsumedStrikes },
            '[StrikeService] Lifting ban because consumed strikes fell below limit',
          );
          await this.liftBan(strike.banId, {
            liftedBy: params.revokedBy,
            reason: 'Strike overturned on appeal',
            tx,
          });
        }
      }

      return updatedStrike;
    };

    const res = params.tx ? await runInTx(params.tx) : await prisma.$transaction(runInTx);

    // Emit event
    emitEvent('strike.revoked', {
      strikeId: res.id,
      driverId: res.driverId,
      revokedById: params.revokedBy,
      reason: params.reason,
    });

    // Notify driver
    NotificationsService.notify({
      key: 'strike.revoked',
      userId: res.driverId,
      data: {
        reason: res.reason,
      },
    }).catch((err) => {
      logger.error({ err, strikeId: res.id }, '[StrikeService] Failed to notify driver of revoked strike');
    });

    return res;
  }

  static async liftBan(
    banId: string,
    params: { liftedBy: string; reason: string; tx?: any },
  ) {
    const runInTx = async (tx: any) => {
      const ban = await tx.driverBan.findUnique({
        where: { id: banId },
      });

      if (!ban) {
        throw new AppError(ERROR_CODES.NOT_FOUND, 404, 'Ban not found');
      }

      const now = new Date();
      const updatedBan = await tx.driverBan.update({
        where: { id: banId },
        data: {
          liftedAt: now,
          liftedById: params.liftedBy,
          liftReason: params.reason,
        },
      });

      // Check if any other active bans exist
      const activeBans = await tx.driverBan.count({
        where: {
          driverId: ban.driverId,
          liftedAt: null,
          OR: [{ endsAt: null }, { endsAt: { gt: now } }],
        },
      });

      if (activeBans === 0) {
        await tx.driverProfile.updateMany({
          where: { userId: ban.driverId },
          data: { bannedUntil: null },
        });
      }

      // Audit Log
      await tx.auditLog.create({
        data: {
          actorId: params.liftedBy,
          actorType: 'USER',
          action: 'BAN_LIFTED',
          entityType: 'DRIVER_BAN',
          entityId: banId,
          newValues: {
            liftedAt: now,
            liftReason: params.reason,
          },
        },
      });

      return updatedBan;
    };

    const res = params.tx ? await runInTx(params.tx) : await prisma.$transaction(runInTx);

    // Emit event
    emitEvent('ban.lifted', {
      banId: res.id,
      driverId: res.driverId,
      liftedById: params.liftedBy,
      reason: params.reason,
    });

    // Notify driver
    NotificationsService.notify({
      key: 'ban.ended',
      userId: res.driverId,
      data: {},
    }).catch((err) => {
      logger.error({ err, banId: res.id }, '[StrikeService] Failed to notify driver of ban lifted');
    });

    return res;
  }

  static async permanentBlock(
    driverUserId: string,
    params: { blockedBy: string; reason: string; tx?: any },
  ) {
    const runInTx = async (tx: any) => {
      const now = new Date();
      const ban = await tx.driverBan.create({
        data: {
          driverId: driverUserId,
          type: BAN_TYPES.PERMANENT as any,
          startsAt: now,
          endsAt: null,
          reason: params.reason,
          createdById: params.blockedBy,
        },
      });

      await tx.driverProfile.updateMany({
        where: { userId: driverUserId },
        data: { bannedUntil: new Date('2099-12-31T23:59:59.000Z') },
      });

      // Terminate active assignments
      const activeAssignments = await tx.assignment.findMany({
        where: {
          driver: { userId: driverUserId },
          status: {
            in: [
              ASSIGNMENT_STATUS.RESERVED,
              ASSIGNMENT_STATUS.INSTALLING,
              ASSIGNMENT_STATUS.INSTALL_SUBMITTED,
              ASSIGNMENT_STATUS.INSTALL_APPROVED,
              ASSIGNMENT_STATUS.RUNNING,
            ],
          },
        },
      });

      for (const assignment of activeAssignments) {
        await TerminationService.terminate(assignment.id, {
          reason: 'PERMANENT_BAN',
          terminatedById: params.blockedBy,
          notes: params.reason,
          tx,
        });
      }

      await tx.auditLog.create({
        data: {
          actorId: params.blockedBy,
          actorType: 'USER',
          action: 'DRIVER_PERMANENTLY_BLOCKED',
          entityType: 'DRIVER_BAN',
          entityId: ban.id,
          newValues: {
            driverId: driverUserId,
            reason: params.reason,
          },
        },
      });

      return ban;
    };

    const res = params.tx ? await runInTx(params.tx) : await prisma.$transaction(runInTx);

    emitEvent('ban.started', {
      banId: res.id,
      driverId: driverUserId,
      type: BAN_TYPES.PERMANENT,
      endsAt: null,
      reason: params.reason,
    });

    NotificationsService.notify({
      key: 'ban.started',
      userId: driverUserId,
      data: {
        reason: params.reason,
        endsAt: 'Permanent',
      },
    }).catch((err) => {
      logger.error({ err, banId: res.id }, '[StrikeService] Failed to notify driver of permanent block');
    });

    return res;
  }

  static async listStrikes(options: {
    driverId?: string;
    status?: string;
    page?: number;
    limit?: number;
  }) {
    const page = Math.max(1, options.page ?? 1);
    const limit = Math.max(1, Math.min(100, options.limit ?? 20));
    const skip = (page - 1) * limit;

    const where: any = {};
    if (options.driverId) where.driverId = options.driverId;
    if (options.status) where.status = options.status;

    const [items, total] = await Promise.all([
      prisma.strike.findMany({
        where,
        orderBy: { issuedAt: 'desc' },
        skip,
        take: limit,
        include: {
          driver: { select: { id: true, mobile: true, email: true, driverProfile: { select: { fullName: true } } } },
          revokedBy: { select: { id: true, mobile: true, email: true } },
        },
      }),
      prisma.strike.count({ where }),
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

  static async listBans(options: {
    driverId?: string;
    page?: number;
    limit?: number;
  }) {
    const page = Math.max(1, options.page ?? 1);
    const limit = Math.max(1, Math.min(100, options.limit ?? 20));
    const skip = (page - 1) * limit;

    const where: any = {};
    if (options.driverId) where.driverId = options.driverId;

    const [items, total] = await Promise.all([
      prisma.driverBan.findMany({
        where,
        orderBy: { startsAt: 'desc' },
        skip,
        take: limit,
        include: {
          driver: { select: { id: true, mobile: true, email: true, driverProfile: { select: { fullName: true } } } },
        },
      }),
      prisma.driverBan.count({ where }),
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

  static async getDriverDiscipline(driverUserId: string) {
    const now = new Date();
    const [strikes, bans, notices, profile] = await Promise.all([
      prisma.strike.findMany({
        where: { driverId: driverUserId },
        orderBy: { issuedAt: 'desc' },
      }),
      prisma.driverBan.findMany({
        where: { driverId: driverUserId },
        orderBy: { startsAt: 'desc' },
      }),
      prisma.posterFixNotice.findMany({
        where: { assignment: { driverId: driverUserId } },
        orderBy: { openedAt: 'desc' },
      }),
      prisma.driverProfile.findUnique({
        where: { userId: driverUserId },
        select: { strikesCount: true, bannedUntil: true },
      }),
    ]);

    const activeStrikes = strikes.filter(
      (s) => s.status === STRIKE_STATUS.ACTIVE && s.expiresAt > now,
    );
    const isBanned = Boolean(profile?.bannedUntil && profile.bannedUntil > now);

    return {
      activeStrikesCount: activeStrikes.length,
      totalStrikesCount: strikes.length,
      isBanned,
      bannedUntil: profile?.bannedUntil,
      strikes,
      bans,
      notices,
    };
  }
}
