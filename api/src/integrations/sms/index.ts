import { type Language } from '@ap/shared-constants';
import { env } from '../../config/env.js';
import { logger } from '../../shared/logger/index.js';

export interface SmsTemplateDefinition {
  templateId: string;
  pattern: string;
}

export const DLT_TEMPLATES: Record<string, SmsTemplateDefinition> = {
  DLT_OTP_LOGIN: {
    templateId: '1107161234567890123',
    pattern: 'Your Auto Poster verification code is {{code}}. Valid for 10 minutes.',
  },
  DLT_PWD_RESET: {
    templateId: '1107161234567890124',
    pattern: 'Your Auto Poster password reset code is {{code}}.',
  },
  DLT_LOGIN_LOCKED: {
    templateId: '1107161234567890125',
    pattern: 'Your Auto Poster account is locked due to multiple failed login attempts.',
  },
  DLT_KYC_APPROVED: {
    templateId: '1107161234567890126',
    pattern: 'Your Auto Poster KYC verification has been approved! You are ready to earn.',
  },
  DLT_KYC_REJECTED: {
    templateId: '1107161234567890127',
    pattern: 'Your Auto Poster KYC verification was not approved. Please review reasons in app.',
  },
  DLT_KYC_NEED_INFO: {
    templateId: '1107161234567890128',
    pattern: 'Auto Poster: More information is required for your KYC verification. Open app to update.',
  },
  DLT_INSTALL_REMINDER: {
    templateId: '1107161234567890129',
    pattern: 'Auto Poster: Only {{hours}} hours left to complete poster installation for {{title}}.',
  },
  DLT_INSTALL_APPROVED: {
    templateId: '1107161234567890130',
    pattern: 'Auto Poster: Installation approved! ₹{{allowance}} credited to your wallet.',
  },
  DLT_INSTALL_REJECTED: {
    templateId: '1107161234567890131',
    pattern: 'Auto Poster: Installation photo rejected: {{reason}}. Please resubmit.',
  },
  DLT_ASSIGNMENT_TERMINATED: {
    templateId: '1107161234567890132',
    pattern: 'Auto Poster: Assignment terminated for {{title}}: {{reason}}.',
  },
  DLT_PHOTO_REJECTED: {
    templateId: '1107161234567890133',
    pattern: 'Auto Poster: Daily photo for {{date}} rejected: {{reason}}. Resubmit before 10 PM.',
  },
  DLT_SETTLEMENT_PAID: {
    templateId: '1107161234567890134',
    pattern: 'Auto Poster: ₹{{amount}} campaign earnings credited to your wallet!',
  },
  DLT_PAYOUT_PAID: {
    templateId: '1107161234567890135',
    pattern: 'Auto Poster: ₹{{amount}} has been sent to your bank account/UPI (Ref: {{ref}}).',
  },
  DLT_PAYOUT_FAILED: {
    templateId: '1107161234567890136',
    pattern: 'Auto Poster: Payout of ₹{{amount}} failed: {{reason}}. Money returned to wallet.',
  },
  DLT_STRIKE_ISSUED: {
    templateId: '1107161234567890137',
    pattern: 'Auto Poster WARNING: You received a strike for {{reason}}. Appeal before {{appealDeadline}}.',
  },
  DLT_BAN_STARTED: {
    templateId: '1107161234567890138',
    pattern: 'Auto Poster: Account banned until {{endsAt}}: {{reason}}.',
  },
  DLT_POSTER_FIX_OPEN: {
    templateId: '1107161234567890139',
    pattern: 'Auto Poster ACTION REQUIRED: Re-paste or repair poster within 48h to avoid a strike.',
  },
  DLT_POSTER_FIX_REMIND: {
    templateId: '1107161234567890140',
    pattern: 'Auto Poster URGENT: Only 6 hours left to fix poster and upload proof.',
  },
  DLT_DISPUTE_INFO_REQ: {
    templateId: '1107161234567890141',
    pattern: 'Auto Poster: Action required on Dispute #{{disputeId}}. Please submit information.',
  },
  DLT_DISPUTE_RESOLVED: {
    templateId: '1107161234567890142',
    pattern: 'Auto Poster: Dispute #{{disputeId}} has been resolved: {{decision}}.',
  },
};

export interface SmsProvider {
  sendOtp(target: string, code: string, language?: Language): Promise<void>;
  sendMessage(target: string, message: string): Promise<void>;
  sendTemplate(
    target: string,
    templateKey: string,
    params: Record<string, string | number>,
    language?: Language,
  ): Promise<void>;
}

export class DevSmsProvider implements SmsProvider {
  async sendOtp(target: string, code: string, language: Language = 'en'): Promise<void> {
    if (env.NODE_ENV === 'production') {
      throw new Error('FATAL: DevSmsProvider cannot be used in production environment!');
    }

    const banner = [
      '==============================================================',
      ' [DEV ONLY] SMS OTP DISPATCHED (DO NOT USE IN PRODUCTION)',
      ` Recipient: ${target}`,
      ` OTP Code:  ${code}`,
      ` Language:  ${language}`,
      '==============================================================',
    ].join('\n');

    process.stdout.write(`\n${banner}\n\n`);
    logger.info({ target, language }, '[DevSmsProvider] OTP dispatched to console');
  }

  async sendMessage(target: string, message: string): Promise<void> {
    if (env.NODE_ENV === 'production') {
      throw new Error('FATAL: DevSmsProvider cannot be used in production environment!');
    }
    logger.info({ target, message }, '[DevSmsProvider] SMS message dispatched to console');
  }

  async sendTemplate(
    target: string,
    templateKey: string,
    params: Record<string, string | number>,
    language: Language = 'en',
  ): Promise<void> {
    if (env.NODE_ENV === 'production') {
      throw new Error('FATAL: DevSmsProvider cannot be used in production environment!');
    }

    const tpl = DLT_TEMPLATES[templateKey];
    let rendered = tpl ? tpl.pattern : `[Template ${templateKey}]`;
    for (const [k, v] of Object.entries(params)) {
      rendered = rendered.replace(new RegExp(`{{${k}}}`, 'g'), String(v));
    }

    const banner = [
      '==============================================================',
      ' [DEV ONLY] TEMPLATED SMS DISPATCHED',
      ` Recipient:   ${target}`,
      ` TemplateId:  ${tpl?.templateId ?? templateKey}`,
      ` Language:    ${language}`,
      ` Body:        ${rendered}`,
      '==============================================================',
    ].join('\n');

    process.stdout.write(`\n${banner}\n\n`);
    logger.info({ target, templateKey, params }, '[DevSmsProvider] Template SMS dispatched');
  }
}

export class NoopSmsProvider implements SmsProvider {
  async sendOtp(target: string, _code: string, language: Language = 'en'): Promise<void> {
    logger.debug({ target, language }, '[NoopSmsProvider] sendOtp called (no-op)');
  }

  async sendMessage(target: string, _message: string): Promise<void> {
    logger.debug({ target }, '[NoopSmsProvider] sendMessage called (no-op)');
  }

  async sendTemplate(
    target: string,
    templateKey: string,
    _params: Record<string, string | number>,
    language: Language = 'en',
  ): Promise<void> {
    logger.debug({ target, templateKey, language }, '[NoopSmsProvider] sendTemplate called (no-op)');
  }
}

let smsProviderInstance: SmsProvider | null = null;

export function getSmsProvider(): SmsProvider {
  if (!smsProviderInstance) {
    if (env.SMS_PROVIDER === 'dev') {
      smsProviderInstance = new DevSmsProvider();
    } else {
      smsProviderInstance = new NoopSmsProvider();
    }
  }
  return smsProviderInstance;
}
