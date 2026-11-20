import type { Request, Response, NextFunction } from 'express';
import { clock } from '../../shared/clock/index.js';
import { env } from '../../config/env.js';
import { ForbiddenError, ValidationError } from '../../shared/errors/index.js';
import { logger } from '../../shared/logger/index.js';
import { processJob, JOB_NAMES } from '../../jobs/index.js';

export class DevClockController {
  private static assertAllowed(): void {
    if (env.DB_ENVIRONMENT === 'production' || !env.CLOCK_CONTROL_ENABLED) {
      throw new ForbiddenError('Clock control is strictly disabled in production environment');
    }
  }

  static async getClock(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (env.DB_ENVIRONMENT === 'production' || !env.CLOCK_CONTROL_ENABLED) {
        res.json({
          success: true,
          data: {
            simulatedTime: new Date().toISOString(),
            simulatedTimeIst: new Date().toISOString(),
            todayIst: new Date().toISOString().split('T')[0],
            offsetMs: 0,
            isRealTime: true,
            environment: env.DB_ENVIRONMENT,
          },
        });
        return;
      }

      await clock.init();

      res.json({
        success: true,
        data: {
          simulatedTime: clock.nowIso(),
          simulatedTimeIst: clock.formatIst(),
          todayIst: clock.todayIst(),
          offsetMs: clock.getOffsetMs(),
          isRealTime: !clock.isShifted(),
          environment: env.DB_ENVIRONMENT,
        },
      });
    } catch (err) {
      next(err);
    }
  }

  static async advanceClock(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      DevClockController.assertAllowed();

      const { days = 0, hours = 0, minutes = 0, seconds = 0, offsetMs = 0 } = req.body;
      const totalDeltaMs =
        (Number(days) * 86400 +
          Number(hours) * 3600 +
          Number(minutes) * 60 +
          Number(seconds)) *
          1000 +
        Number(offsetMs);

      if (isNaN(totalDeltaMs) || totalDeltaMs <= 0) {
        throw new ValidationError('A positive duration (days, hours, minutes, seconds, or offsetMs) must be provided');
      }

      const updatedOffset = await clock.advance(totalDeltaMs);
      logger.warn(
        { deltaMs: totalDeltaMs, updatedOffset, actor: req.auth?.userId || 'dev' },
        '[DevClock] Application clock advanced',
      );

      res.json({
        success: true,
        data: {
          simulatedTime: clock.nowIso(),
          simulatedTimeIst: clock.formatIst(),
          todayIst: clock.todayIst(),
          offsetMs: updatedOffset,
          isRealTime: false,
          environment: env.DB_ENVIRONMENT,
        },
      });
    } catch (err) {
      next(err);
    }
  }

  static async resetClock(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      DevClockController.assertAllowed();

      await clock.reset();
      logger.info(
        { actor: req.auth?.userId || 'dev' },
        '[DevClock] Application clock reset to real-time',
      );

      res.json({
        success: true,
        data: {
          simulatedTime: clock.nowIso(),
          simulatedTimeIst: clock.formatIst(),
          todayIst: clock.todayIst(),
          offsetMs: 0,
          isRealTime: true,
          environment: env.DB_ENVIRONMENT,
        },
      });
    } catch (err) {
      next(err);
    }
  }

  static async runDueJobs(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      DevClockController.assertAllowed();
      const results: Record<string, any> = {};
      const jobList = [
        JOB_NAMES.CAMPAIGN_START,
        JOB_NAMES.ASSIGNMENT_START,
        JOB_NAMES.DAILY_DAY_ROLL,
        JOB_NAMES.ASSIGNMENT_COMPLETE,
        JOB_NAMES.CAMPAIGN_COMPLETE,
        JOB_NAMES.SETTLEMENT_TRIGGER,
        JOB_NAMES.CLOSEOUT_TRIGGER,
      ];
      for (const name of jobList) {
        try {
          results[name] = await processJob(name);
        } catch (e: any) {
          results[name] = { error: e.message };
        }
      }
      res.json({ success: true, data: results });
    } catch (err) {
      next(err);
    }
  }
}

