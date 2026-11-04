import {
  SETTING_KEYS,
  type SettingKey,
  ERROR_CODES,
  ACTOR_TYPES,
} from '@ap/shared-constants';
import { validateSettingValue } from '@ap/shared-validation';
import { prisma } from '../../../shared/db/index.js';
import { SettingsService } from '../../settings/settings.service.js';
import { AuditService } from '../../audit/audit.service.js';
import { DEFAULT_SETTINGS } from '../../../seeds/base.js';
import {
  AppError,
  NotFoundError,
  ForbiddenError,
  ValidationError,
} from '../../../shared/errors/index.js';

export const SETTING_CATEGORIES = {
  GENERAL: [
    SETTING_KEYS.TERMS_VERSION,
    SETTING_KEYS.PRIVACY_VERSION,
    SETTING_KEYS.POSTER_POLICY_VERSION,
    SETTING_KEYS.UPLOAD_MAX_BYTES,
    SETTING_KEYS.SIGNED_URL_TTL_SECONDS,
  ],
  PRICING_AND_COMMISSION: [
    SETTING_KEYS.COMMISSION_RATE_BPS,
    SETTING_KEYS.GST_RATE_BPS,
    SETTING_KEYS.DEFAULT_PRINTING_ALLOWANCE_PAISE,
    SETTING_KEYS.DEFAULT_DAILY_RENT_PAISE,
    SETTING_KEYS.MIN_DAYS,
    SETTING_KEYS.MAX_DAYS,
    SETTING_KEYS.MIN_RENT_PER_30_DAYS_PAISE,
    SETTING_KEYS.MAX_RENT_PER_30_DAYS_PAISE,
    SETTING_KEYS.MAX_PRINTING_ALLOWANCE_PAISE,
  ],
  VERIFICATION_AND_PHOTOS: [
    SETTING_KEYS.DAILY_PHOTO_START_HOUR,
    SETTING_KEYS.DAILY_PHOTO_END_HOUR,
    SETTING_KEYS.AUTO_APPROVE_INSTALLATION_AFTER_HOURS,
    SETTING_KEYS.PHOTO_MAX_AGE_MINUTES,
    SETTING_KEYS.PHOTO_MAX_DISTANCE_METERS,
    SETTING_KEYS.PHOTO_DHASH_THRESHOLD,
    SETTING_KEYS.PHASH_SAME_ASSIGNMENT_THRESHOLD,
    SETTING_KEYS.RISK_AUTO_VERIFY_MAX_SCORE,
    SETTING_KEYS.RANDOM_REVIEW_PERCENT,
  ],
  DISCIPLINE_AND_DISPUTES: [
    SETTING_KEYS.MAX_STRIKES_BEFORE_SUSPENSION,
    SETTING_KEYS.STRIKE_EXPIRY_DAYS,
    SETTING_KEYS.STRIKE_LIMIT,
    SETTING_KEYS.BAN_DAYS,
    SETTING_KEYS.POSTER_FIX_HOURS,
    SETTING_KEYS.DISPUTE_SLA_WORKING_DAYS,
    SETTING_KEYS.MAX_OPEN_DISPUTES_PER_USER,
  ],
  FINANCE_AND_PAYOUTS: [
    SETTING_KEYS.PAYOUT_HOLD_DAYS,
    SETTING_KEYS.PAYOUT_AUTO_APPROVE_MAX_PAISE,
    SETTING_KEYS.PAYOUT_MIN_WITHDRAWAL_PAISE,
    SETTING_KEYS.PAYOUT_MANUAL_REVIEW_THRESHOLD_PAISE,
    SETTING_KEYS.FINANCE_PAYMENTS_ENABLED,
    SETTING_KEYS.FINANCE_PAYOUTS_ENABLED,
    SETTING_KEYS.FINANCE_TDS_RATE_BPS,
    SETTING_KEYS.FINANCE_COMPANY_GSTIN,
  ],
  SECURITY_AND_SYSTEM: [
    SETTING_KEYS.ADMIN_IDLE_TIMEOUT_MINUTES,
    SETTING_KEYS.STEP_UP_TTL_MINUTES,
    SETTING_KEYS.ADMIN_IP_ALLOWLIST,
    SETTING_KEYS.SENSITIVE_SETTING_KEYS,
    SETTING_KEYS.EXPORT_MAX_ROWS,
    SETTING_KEYS.EXPORT_LINK_TTL_HOURS,
    SETTING_KEYS.SEARCH_MIN_CHARS,
    SETTING_KEYS.MAINTENANCE_MODE,
    SETTING_KEYS.MAINTENANCE_MESSAGE,
    SETTING_KEYS.METRICS_TIMEZONE,
  ],
};

export const DEFAULT_SENSITIVE_KEYS: string[] = [
  SETTING_KEYS.COMMISSION_RATE_BPS,
  SETTING_KEYS.GST_RATE_BPS,
  'commission_bps',
  'gst_bps',
  SETTING_KEYS.FINANCE_PAYMENTS_ENABLED,
  SETTING_KEYS.FINANCE_PAYOUTS_ENABLED,
  SETTING_KEYS.ADMIN_IP_ALLOWLIST,
  SETTING_KEYS.STRIKE_LIMIT,
  SETTING_KEYS.BAN_DAYS,
  SETTING_KEYS.PAYOUT_MIN_WITHDRAWAL_PAISE,
  SETTING_KEYS.PAYOUT_AUTO_APPROVE_MAX_PAISE,
  SETTING_KEYS.SETTLEMENT_AUTO_APPROVE_DELAY_HOURS,
  SETTING_KEYS.SETTLEMENT_DELAY_DAYS,
];

export class AdminSettingsService {
  /**
   * Returns all platform settings grouped with defaults, types, and pending change requests.
   */
  static async listGroupedSettings(): Promise<any> {
    const allSettings = await prisma.setting.findMany();
    const settingsMap = new Map(allSettings.map((s) => [s.key, s.value]));

    const pendingRequests = await prisma.settingChangeRequest.findMany({
      where: { status: 'REQUESTED' },
      include: { requestedBy: { select: { email: true, role: true } } },
    });
    const pendingMap = new Map(pendingRequests.map((r) => [r.key, r]));

    const dbSensitiveList = (await SettingsService.get(SETTING_KEYS.SENSITIVE_SETTING_KEYS).catch(
      () => null,
    )) as string[] | null;
    const sensitiveList = dbSensitiveList && dbSensitiveList.length > 0 ? dbSensitiveList : DEFAULT_SENSITIVE_KEYS;

    const groups: Record<string, any[]> = {};

    for (const [category, keys] of Object.entries(SETTING_CATEGORIES)) {
      groups[category] = keys.map((key) => {
        const defaultEntry = DEFAULT_SETTINGS.find((s) => s.key === key);
        const val = settingsMap.get(key) ?? defaultEntry?.value;
        const pending = pendingMap.get(key);
        const isSensitive = sensitiveList.includes(key);

        return {
          key,
          value: val,
          defaultValue: defaultEntry?.value,
          isSensitive,
          pendingChange: pending
            ? {
                id: pending.id,
                newValue: pending.newValue,
                reason: pending.reason,
                requestedBy: pending.requestedBy.email || 'Admin',
                requestedAt: pending.createdAt.toISOString(),
              }
            : null,
        };
      });
    }

    return groups;
  }

  /**
   * Requests a setting change. If sensitive, queues a maker-checker request; otherwise applies immediately.
   */
  static async updateOrRequestSetting(
    actingAdminId: string,
    key: SettingKey,
    newValue: unknown,
    reason: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<any> {
    // 1. Validate value schema
    const parsedValue = validateSettingValue(key, newValue);

    // 2. Check pending requests
    const existingPending = await prisma.settingChangeRequest.findFirst({
      where: { key, status: 'REQUESTED' },
    });
    if (existingPending) {
      throw new AppError(
        ERROR_CODES.SETTING_CHANGE_PENDING,
        'A change request for this setting is already awaiting approval.',
        409,
      );
    }

    // 3. Determine if sensitive
    const dbSensitiveList = (await SettingsService.get(SETTING_KEYS.SENSITIVE_SETTING_KEYS).catch(
      () => null,
    )) as string[] | null;
    const sensitiveList = dbSensitiveList && dbSensitiveList.length > 0 ? dbSensitiveList : DEFAULT_SENSITIVE_KEYS;

    const isSensitive = sensitiveList.includes(key);
    const currentValue = await SettingsService.get(key).catch(() => null);

    if (isSensitive) {
      const changeRequest = await prisma.settingChangeRequest.create({
        data: {
          key,
          oldValue: currentValue as object,
          newValue: parsedValue as object,
          reason,
          requestedById: actingAdminId,
          status: 'REQUESTED',
        },
      });

      await AuditService.log({
        actorId: actingAdminId,
        actorType: ACTOR_TYPES.USER,
        action: 'SETTING_CHANGE_REQUESTED',
        entityType: 'setting',
        entityId: changeRequest.id,
        newValues: { key, newValue: parsedValue, reason },
        ipAddress,
        userAgent,
      });

      return {
        requiresApproval: true,
        requestId: changeRequest.id,
        message: 'Sensitive setting change request submitted for two-person review.',
      };
    }

    // Non-sensitive: direct update
    await SettingsService.set(key, parsedValue, actingAdminId, { ipAddress, userAgent });

    await AuditService.log({
      actorId: actingAdminId,
      actorType: ACTOR_TYPES.USER,
      action: 'SETTING_UPDATED',
      entityType: 'setting',
      entityId: key,
      oldValues: { value: currentValue },
      newValues: { value: parsedValue, reason },
      ipAddress,
      userAgent,
    });

    return {
      requiresApproval: false,
      key,
      value: parsedValue,
      message: 'Setting updated successfully.',
    };
  }

  /**
   * Reviews a pending setting change request (Maker-Checker approval).
   */
  static async reviewChangeRequest(
    actingAdminId: string,
    requestId: string,
    decision: 'APPROVE' | 'REJECT',
    ipAddress?: string,
    userAgent?: string,
  ): Promise<void> {
    const request = await prisma.settingChangeRequest.findUnique({
      where: { id: requestId },
    });

    if (!request) {
      throw new NotFoundError('Setting change request not found');
    }

    if (request.status !== 'REQUESTED') {
      throw new ValidationError('This request has already been processed');
    }

    // Maker-checker rule: cannot approve your own request
    if (request.requestedById === actingAdminId) {
      throw new ForbiddenError(
        'Maker-checker policy violation: You cannot review or approve your own setting change request.',
      );
    }

    if (decision === 'APPROVE') {
      await SettingsService.set(request.key as SettingKey, request.newValue, actingAdminId, {
        ipAddress,
        userAgent,
      });

      await prisma.settingChangeRequest.update({
        where: { id: requestId },
        data: {
          status: 'APPROVED',
          approvedById: actingAdminId,
          appliedAt: new Date(),
        },
      });

      await AuditService.log({
        actorId: actingAdminId,
        actorType: ACTOR_TYPES.USER,
        action: 'SETTING_CHANGE_APPROVED',
        entityType: 'setting_change_request',
        entityId: requestId,
        newValues: { key: request.key, appliedValue: request.newValue },
        ipAddress,
        userAgent,
      });
    } else {
      await prisma.settingChangeRequest.update({
        where: { id: requestId },
        data: {
          status: 'REJECTED',
          approvedById: actingAdminId,
        },
      });

      await AuditService.log({
        actorId: actingAdminId,
        actorType: ACTOR_TYPES.USER,
        action: 'SETTING_CHANGE_REJECTED',
        entityType: 'setting_change_request',
        entityId: requestId,
        newValues: { key: request.key },
        ipAddress,
        userAgent,
      });
    }
  }

  /**
   * Lists all setting change requests with requester and approver metadata.
   */
  static async listChangeRequests(): Promise<any[]> {
    const requests = await prisma.settingChangeRequest.findMany({
      include: {
        requestedBy: { select: { email: true, role: true } },
        approvedBy: { select: { email: true, role: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    return requests.map((r) => ({
      id: r.id,
      key: r.key,
      oldValue: r.oldValue,
      newValue: r.newValue,
      reason: r.reason,
      status: r.status,
      requestedBy: r.requestedBy.email || 'Admin',
      approvedBy: r.approvedBy?.email || null,
      appliedAt: r.appliedAt ? r.appliedAt.toISOString() : null,
      createdAt: r.createdAt.toISOString(),
    }));
  }
}
