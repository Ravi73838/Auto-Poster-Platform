import { prisma } from '../../../shared/db/index.js';
import { getRedisClient } from '../../../shared/redis/index.js';
import { env } from '../../../config/env.js';
import { logger } from '../../../shared/logger/index.js';
import {
  PILOT_SIGN_OFF_KEYS,
  SETTING_KEYS,
  ERROR_CODES,
  type PilotSignOffKey,
} from '@ap/shared-constants';
import { AppError, ForbiddenError, ValidationError } from '../../../shared/errors/index.js';
import type { LaunchReadiness, PilotSignOff } from '@ap/shared-types';

export const SIGN_OFF_DEFINITIONS: Record<
  PilotSignOffKey,
  { label: string; description: string }
> = {
  legal_documents_reviewed: {
    label: 'Legal Documents Reviewed',
    description: 'Pilot driver and advertiser agreements, privacy policy, and terms of service reviewed by legal counsel.',
  },
  ca_invoice_gst_confirmed: {
    label: 'CA Invoice & GST Confirmation',
    description: 'Tax structure, GST billing, and reverse charge applicability confirmed with chartered accountant.',
  },
  payment_structure_confirmed: {
    label: 'Escrow & Payment Architecture Confirmed',
    description: 'Dedicated bank escrow / nodal account active with Razorpay Route / linked accounts configured.',
  },
  pentest_completed: {
    label: 'Penetration Testing & Security Audit',
    description: 'Automated vulnerability scanning and security audit executed with 0 critical findings.',
  },
  razorpay_live_activated: {
    label: 'Razorpay Live Key Activation',
    description: 'Production merchant account credentials verified and webhook endpoints secured.',
  },
  sms_dlt_registered: {
    label: 'DLT SMS Templates Approved',
    description: 'All 19 transactional and service-implicit DLT templates approved on telecom portal.',
  },
  backups_verified: {
    label: 'Disaster Recovery Drill Completed',
    description: 'Database point-in-time recovery and emergency service shutdown runbooks tested.',
  },
  support_roster_ready: {
    label: 'Support Desk & Callback Staffed',
    description: 'WhatsApp helpline, admin support desk queues, and callback response shifts assigned.',
  },
};

export class LaunchService {
  static async getSignOffs(): Promise<PilotSignOff[]> {
    const setting = await prisma.setting.findUnique({
      where: { key: SETTING_KEYS.LAUNCH_SIGNOFFS },
    });

    const storedMap = (setting?.value || {}) as Record<string, Partial<PilotSignOff>>;

    return (PILOT_SIGN_OFF_KEYS as readonly PilotSignOffKey[]).map((key) => {
      const def = SIGN_OFF_DEFINITIONS[key] || {
        label: key,
        description: 'Launch readiness attestation gate',
      };
      const entry = storedMap[key] || {};
      return {
        key,
        label: def.label,
        description: def.description,
        attested: Boolean(entry.attested),
        attestedBy: entry.attestedBy,
        attestedByEmail: entry.attestedByEmail,
        attestedAt: entry.attestedAt,
        notes: entry.notes,
        ipAddress: entry.ipAddress,
      };
    });
  }

  static async attestSignOff(params: {
    key: PilotSignOffKey;
    userId: string;
    userEmail: string;
    notes?: string;
    ipAddress?: string;
  }): Promise<PilotSignOff[]> {
    if (!PILOT_SIGN_OFF_KEYS.includes(params.key)) {
      throw new ValidationError(`Invalid sign-off key: ${params.key}`);
    }

    const setting = await prisma.setting.findUnique({
      where: { key: SETTING_KEYS.LAUNCH_SIGNOFFS },
    });

    const storedMap = ((setting?.value || {}) as Record<string, any>);
    storedMap[params.key] = {
      attested: true,
      attestedBy: params.userId,
      attestedByEmail: params.userEmail,
      attestedAt: new Date().toISOString(),
      notes: params.notes || null,
      ipAddress: params.ipAddress || null,
    };

    await prisma.setting.upsert({
      where: { key: SETTING_KEYS.LAUNCH_SIGNOFFS },
      create: {
        key: SETTING_KEYS.LAUNCH_SIGNOFFS,
        value: storedMap,
        description: 'Attestations for Phase 15 launch readiness gates',
        updatedByUserId: params.userId,
      },
      update: {
        value: storedMap,
        updatedByUserId: params.userId,
      },
    });

    logger.info(
      { key: params.key, attestedBy: params.userEmail, ip: params.ipAddress },
      '[LaunchService] Sign-off attested',
    );

    return this.getSignOffs();
  }

  static async revokeSignOff(params: {
    key: PilotSignOffKey;
    userId: string;
    userEmail: string;
  }): Promise<PilotSignOff[]> {
    const setting = await prisma.setting.findUnique({
      where: { key: SETTING_KEYS.LAUNCH_SIGNOFFS },
    });

    const storedMap = ((setting?.value || {}) as Record<string, any>);
    if (storedMap[params.key]) {
      delete storedMap[params.key];

      await prisma.setting.update({
        where: { key: SETTING_KEYS.LAUNCH_SIGNOFFS },
        data: {
          value: storedMap,
          updatedByUserId: params.userId,
        },
      });

      logger.warn(
        { key: params.key, revokedBy: params.userEmail },
        '[LaunchService] Sign-off revoked',
      );
    }

    return this.getSignOffs();
  }

  static async assertAllSignedOff(): Promise<void> {
    if (env.DB_ENVIRONMENT !== 'production') {
      return;
    }

    const signOffs = await this.getSignOffs();
    const missing = signOffs.filter((s) => !s.attested);

    if (missing.length > 0) {
      const keys = missing.map((m) => m.key).join(', ');
      throw new AppError(
        ERROR_CODES.LAUNCH_SIGNOFFS_MISSING,
        403,
        `Operation blocked: Missing required launch sign-offs: ${keys}`,
      );
    }
  }

  static async getLaunchReadiness(): Promise<LaunchReadiness> {
    const checks: LaunchReadiness['checks'] = [];
    const signOffs = await this.getSignOffs();

    // 1. Database Check
    const dbStart = Date.now();
    try {
      await prisma.$queryRaw`SELECT 1`;
      checks.push({
        id: 'database',
        name: 'PostgreSQL Database Connection',
        status: 'PASS',
        message: `Connected (${Date.now() - dbStart}ms)`,
      });
    } catch (err: any) {
      checks.push({
        id: 'database',
        name: 'PostgreSQL Database Connection',
        status: 'FAIL',
        message: err.message,
      });
    }

    // 2. Redis Check
    const redisStart = Date.now();
    try {
      const client = getRedisClient();
      if (client.status === 'ready' || client.status === 'connect') {
        await client.ping();
        checks.push({
          id: 'redis',
          name: 'Redis Cache & Queue Server',
          status: 'PASS',
          message: `Connected (${Date.now() - redisStart}ms)`,
        });
      } else {
        checks.push({
          id: 'redis',
          name: 'Redis Cache & Queue Server',
          status: env.DB_ENVIRONMENT === 'production' ? 'FAIL' : 'WARN',
          message: `Redis client status: ${client.status}`,
        });
      }
    } catch (err: any) {
      checks.push({
        id: 'redis',
        name: 'Redis Cache & Queue Server',
        status: env.DB_ENVIRONMENT === 'production' ? 'FAIL' : 'WARN',
        message: err.message,
      });
    }

    // 3. Payment Gateway Check
    const isRazorpayTest = env.RAZORPAY_KEY_ID?.startsWith('rzp_test_');
    const isRazorpayLive = env.RAZORPAY_KEY_ID?.startsWith('rzp_live_');
    if (env.DB_ENVIRONMENT === 'production') {
      if (isRazorpayTest) {
        checks.push({
          id: 'payments',
          name: 'Razorpay Payment Gateway Mode',
          status: 'FAIL',
          message: 'Razorpay TEST keys detected in production environment!',
        });
      } else if (!isRazorpayLive) {
        checks.push({
          id: 'payments',
          name: 'Razorpay Payment Gateway Mode',
          status: 'FAIL',
          message: 'No valid live Razorpay key configured.',
        });
      } else {
        checks.push({
          id: 'payments',
          name: 'Razorpay Payment Gateway Mode',
          status: 'PASS',
          message: 'Razorpay LIVE keys configured for production.',
        });
      }
    } else {
      checks.push({
        id: 'payments',
        name: 'Razorpay Payment Gateway Mode',
        status: 'PASS',
        message: isRazorpayTest ? 'Razorpay TEST mode active (safe)' : 'Dev simulation active',
      });
    }

    // 4. SMS Provider Check
    if (env.DB_ENVIRONMENT === 'production') {
      if (env.SMS_PROVIDER === 'dev') {
        checks.push({
          id: 'sms',
          name: 'SMS Notification Provider',
          status: 'FAIL',
          message: 'Dev SMS provider is not permitted in production!',
        });
      } else {
        checks.push({
          id: 'sms',
          name: 'SMS Notification Provider',
          status: 'PASS',
          message: `SMS provider "${env.SMS_PROVIDER}" configured.`,
        });
      }
    } else {
      checks.push({
        id: 'sms',
        name: 'SMS Notification Provider',
        status: 'PASS',
        message: `Provider: ${env.SMS_PROVIDER} (allowlist enforced in non-prod)`,
      });
    }

    // 5. Pilot Caps Check
    const driverCap = await prisma.setting.findUnique({
      where: { key: SETTING_KEYS.PILOT_MAX_DRIVERS },
    });
    if (!driverCap) {
      checks.push({
        id: 'caps',
        name: 'Pilot Guardrail Hard Caps',
        status: 'WARN',
        message: 'Pilot max active drivers cap not explicitly saved in settings table (using default)',
      });
    } else {
      checks.push({
        id: 'caps',
        name: 'Pilot Guardrail Hard Caps',
        status: 'PASS',
        message: `Active drivers cap set to ${driverCap.value}`,
      });
    }

    // Determine overall status
    const allAttested = signOffs.every((s) => s.attested);
    const hasFailures = checks.some((c) => c.status === 'FAIL');
    const hasWarnings = checks.some((c) => c.status === 'WARN');

    let overallStatus: LaunchReadiness['overallStatus'] = 'READY';
    if (hasFailures || (env.DB_ENVIRONMENT === 'production' && !allAttested)) {
      overallStatus = 'BLOCKED';
    } else if (hasWarnings || !allAttested) {
      overallStatus = 'WARNING';
    }

    return {
      environment: env.DB_ENVIRONMENT,
      overallStatus,
      allSignOffsComplete: allAttested,
      signOffs,
      checks,
      checkedAt: new Date().toISOString(),
    };
  }
}
