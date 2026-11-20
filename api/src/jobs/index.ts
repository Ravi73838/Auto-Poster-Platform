import { CampaignJobsService } from './campaign-jobs.service.js';
import { AssignmentJobsService } from './assignment-jobs.service.js';
import { DailyProofJobsService } from './daily-proof-jobs.service.js';
import { MoneyJobsService } from './money-jobs.service.js';
import { DisciplineJobsService } from './discipline-jobs.service.js';
import { DisputeSlaJobService } from './dispute-sla-job.service.js';
import { NotificationsService } from '../modules/notifications/notifications.service.js';
import { logger } from '../shared/logger/index.js';

export const QUEUE_NAME = 'autoposter-scheduled-jobs';

const scheduledTimers: NodeJS.Timeout[] = [];

export const scheduledQueue = {
  name: QUEUE_NAME,
  upsertJobScheduler: async (_name: string, _scheduler: any, _opts: any) => {
    // Registered in-memory
  },
  add: async (name: string, _data?: any) => {
    setImmediate(async () => {
      try {
        await processJob(name);
      } catch (err: any) {
        logger.error({ jobName: name, err: err?.message }, '[JobQueue] In-memory job failed');
      }
    });
  },
  on: (_event: string, _fn: any) => {},
  close: async () => {
    for (const timer of scheduledTimers) {
      clearInterval(timer);
    }
    scheduledTimers.length = 0;
  },
};

export const JOB_NAMES = {
  PAYMENT_EXPIRY: 'campaign-payment-expiry',
  CAMPAIGN_START: 'campaign-start',
  CAMPAIGN_COMPLETE: 'campaign-complete',
  ENROLMENT_CLOSE: 'campaign-enrolment-close',
  REVIEW_SLA_ALERT: 'campaign-review-sla-alert',
  ASSIGNMENT_RESERVATION_EXPIRY: 'assignment-reservation-expiry',
  ASSIGNMENT_RESERVATION_REMINDER: 'assignment-reservation-reminder',
  ASSIGNMENT_INSTALLATION_ESCALATION: 'assignment-installation-escalation',
  ASSIGNMENT_START: 'assignment-start',
  ASSIGNMENT_COMPLETE: 'assignment-complete',
  DAILY_DAY_ROLL: 'daily-day-roll',
  DAILY_PHOTO_REMINDER: 'daily-photo-reminder',
  MISSED_DAY_NOTICE: 'missed-day-notice',
  DAILY_REVIEW_SLA_ALERT: 'daily-review-sla-alert',
  STALE_UPLOAD_CLEANUP: 'stale-upload-cleanup',
  PHOTO_RETENTION: 'photo-retention',
  ALLOWANCE_BACKFILL: 'allowance-backfill',
  SETTLEMENT_TRIGGER: 'settlement-trigger',
  CLOSEOUT_TRIGGER: 'closeout-trigger',
  REFUND_RETRY: 'refund-retry',
  RECONCILIATION_CHECK: 'reconciliation-check',
  POSTER_FIX_DEADLINE: 'poster-fix-deadline',
  BAN_EXPIRY: 'ban-expiry',
  STRIKE_EXPIRY: 'strike-expiry',
  ABANDONMENT_CHECK: 'abandonment-check',
  DISPUTE_SLA: 'dispute-sla',
  NOTIFICATION_RETENTION: 'notification-retention',
} as const;

export async function registerRepeatableJobs(): Promise<void> {
  logger.info('Registered repeatable in-memory scheduled jobs');
}

export async function processJob(jobName: string): Promise<number> {
  switch (jobName) {
    case JOB_NAMES.PAYMENT_EXPIRY:
      return CampaignJobsService.processPaymentExpiry();
    case JOB_NAMES.CAMPAIGN_START:
      return CampaignJobsService.processCampaignStart();
    case JOB_NAMES.CAMPAIGN_COMPLETE:
      return CampaignJobsService.processCampaignComplete();
    case JOB_NAMES.ENROLMENT_CLOSE:
      return CampaignJobsService.processEnrolmentClose();
    case JOB_NAMES.REVIEW_SLA_ALERT:
      return CampaignJobsService.processReviewSlaAlert();
    case JOB_NAMES.ASSIGNMENT_RESERVATION_EXPIRY:
      return AssignmentJobsService.processReservationExpiry();
    case JOB_NAMES.ASSIGNMENT_RESERVATION_REMINDER:
      return AssignmentJobsService.processReservationReminder();
    case JOB_NAMES.ASSIGNMENT_INSTALLATION_ESCALATION:
      return AssignmentJobsService.processInstallationEscalation();
    case JOB_NAMES.ASSIGNMENT_START:
      return AssignmentJobsService.processAssignmentStart();
    case JOB_NAMES.ASSIGNMENT_COMPLETE:
      return AssignmentJobsService.processAssignmentComplete();
    case JOB_NAMES.DAILY_DAY_ROLL:
      return DailyProofJobsService.processDailyDayRoll();
    case JOB_NAMES.DAILY_PHOTO_REMINDER:
      return DailyProofJobsService.processDailyPhotoReminder();
    case JOB_NAMES.MISSED_DAY_NOTICE:
      return DailyProofJobsService.processMissedDayNotice();
    case JOB_NAMES.DAILY_REVIEW_SLA_ALERT:
      return DailyProofJobsService.processDailyReviewSlaAlert();
    case JOB_NAMES.STALE_UPLOAD_CLEANUP:
      return DailyProofJobsService.processStaleUploadCleanup();
    case JOB_NAMES.PHOTO_RETENTION:
      return DailyProofJobsService.processPhotoRetention();
    case JOB_NAMES.ALLOWANCE_BACKFILL: {
      const res = await MoneyJobsService.allowanceBackfill();
      return res.processed;
    }
    case JOB_NAMES.SETTLEMENT_TRIGGER: {
      const res = await MoneyJobsService.settlementTrigger();
      return res.processed;
    }
    case JOB_NAMES.CLOSEOUT_TRIGGER: {
      const res = await MoneyJobsService.closeoutTrigger();
      return res.processed;
    }
    case JOB_NAMES.REFUND_RETRY: {
      const res = await MoneyJobsService.refundRetry();
      return res.processed;
    }
    case JOB_NAMES.RECONCILIATION_CHECK: {
      const res = await MoneyJobsService.reconciliationCheck();
      return res.isBalanced ? 1 : 0;
    }
    case JOB_NAMES.POSTER_FIX_DEADLINE:
      return DisciplineJobsService.processPosterFixDeadlines();
    case JOB_NAMES.BAN_EXPIRY:
      return DisciplineJobsService.processBanExpiry();
    case JOB_NAMES.STRIKE_EXPIRY:
      return DisciplineJobsService.processStrikeExpiry();
    case JOB_NAMES.ABANDONMENT_CHECK:
      return DisciplineJobsService.processAbandonmentCheck();
    case JOB_NAMES.DISPUTE_SLA:
      return DisputeSlaJobService.processDisputeSla();
    case JOB_NAMES.NOTIFICATION_RETENTION:
      return NotificationsService.purgeStale();
    default:
      logger.warn({ jobName }, 'Unknown job name received by worker');
      return 0;
  }
}

export function createWorker() {
  logger.info('Initializing in-memory background worker intervals');

  // 5-minute interval
  const timer5m = setInterval(() => {
    processJob(JOB_NAMES.ASSIGNMENT_RESERVATION_EXPIRY).catch(() => {});
  }, 5 * 60 * 1000).unref();
  scheduledTimers.push(timer5m);

  // 15-minute interval
  const timer15m = setInterval(() => {
    processJob(JOB_NAMES.PAYMENT_EXPIRY).catch(() => {});
    processJob(JOB_NAMES.CAMPAIGN_START).catch(() => {});
    processJob(JOB_NAMES.CAMPAIGN_COMPLETE).catch(() => {});
    processJob(JOB_NAMES.ENROLMENT_CLOSE).catch(() => {});
    processJob(JOB_NAMES.ASSIGNMENT_START).catch(() => {});
    processJob(JOB_NAMES.ASSIGNMENT_COMPLETE).catch(() => {});
    processJob(JOB_NAMES.DAILY_DAY_ROLL).catch(() => {});
    processJob(JOB_NAMES.ALLOWANCE_BACKFILL).catch(() => {});
    processJob(JOB_NAMES.SETTLEMENT_TRIGGER).catch(() => {});
    processJob(JOB_NAMES.REFUND_RETRY).catch(() => {});
  }, 15 * 60 * 1000).unref();
  scheduledTimers.push(timer15m);

  // 30-minute interval
  const timer30m = setInterval(() => {
    processJob(JOB_NAMES.MISSED_DAY_NOTICE).catch(() => {});
    processJob(JOB_NAMES.CLOSEOUT_TRIGGER).catch(() => {});
  }, 30 * 60 * 1000).unref();
  scheduledTimers.push(timer30m);

  // 1-hour interval
  const timer1h = setInterval(() => {
    processJob(JOB_NAMES.REVIEW_SLA_ALERT).catch(() => {});
    processJob(JOB_NAMES.ASSIGNMENT_RESERVATION_REMINDER).catch(() => {});
    processJob(JOB_NAMES.ASSIGNMENT_INSTALLATION_ESCALATION).catch(() => {});
    processJob(JOB_NAMES.DAILY_PHOTO_REMINDER).catch(() => {});
    processJob(JOB_NAMES.DAILY_REVIEW_SLA_ALERT).catch(() => {});
    processJob(JOB_NAMES.POSTER_FIX_DEADLINE).catch(() => {});
    processJob(JOB_NAMES.BAN_EXPIRY).catch(() => {});
    processJob(JOB_NAMES.DISPUTE_SLA).catch(() => {});
  }, 60 * 60 * 1000).unref();
  scheduledTimers.push(timer1h);

  // 24-hour interval
  const timer24h = setInterval(() => {
    processJob(JOB_NAMES.STALE_UPLOAD_CLEANUP).catch(() => {});
    processJob(JOB_NAMES.PHOTO_RETENTION).catch(() => {});
    processJob(JOB_NAMES.RECONCILIATION_CHECK).catch(() => {});
    processJob(JOB_NAMES.STRIKE_EXPIRY).catch(() => {});
    processJob(JOB_NAMES.ABANDONMENT_CHECK).catch(() => {});
    processJob(JOB_NAMES.NOTIFICATION_RETENTION).catch(() => {});
  }, 24 * 60 * 60 * 1000).unref();
  scheduledTimers.push(timer24h);

  return {
    close: async () => {
      for (const t of scheduledTimers) {
        clearInterval(t);
      }
      scheduledTimers.length = 0;
    },
    on: (_event: string, _fn: any) => {},
  };
}

/**
 * Runs all scheduled jobs sequentially in-process. Useful for testing or immediate execution.
 */
export async function runAllScheduledJobsOnce(): Promise<{
  paymentExpiry: number;
  campaignStart: number;
  campaignComplete: number;
  enrolmentClose: number;
  reviewSlaAlert: number;
  reservationExpiry: number;
  reservationReminder: number;
  installationEscalation: number;
  assignmentStart: number;
  assignmentComplete: number;
}> {
  const paymentExpiry = await CampaignJobsService.processPaymentExpiry();
  const campaignStart = await CampaignJobsService.processCampaignStart();
  const campaignComplete = await CampaignJobsService.processCampaignComplete();
  const enrolmentClose = await CampaignJobsService.processEnrolmentClose();
  const reviewSlaAlert = await CampaignJobsService.processReviewSlaAlert();
  const reservationExpiry = await AssignmentJobsService.processReservationExpiry();
  const reservationReminder = await AssignmentJobsService.processReservationReminder();
  const installationEscalation = await AssignmentJobsService.processInstallationEscalation();
  const assignmentStart = await AssignmentJobsService.processAssignmentStart();
  const assignmentComplete = await AssignmentJobsService.processAssignmentComplete();

  return {
    paymentExpiry,
    campaignStart,
    campaignComplete,
    enrolmentClose,
    reviewSlaAlert,
    reservationExpiry,
    reservationReminder,
    installationEscalation,
    assignmentStart,
    assignmentComplete,
  };
}
