import nodemailer, { type Transporter } from 'nodemailer';
import { type Language } from '@ap/shared-constants';
import { env } from '../../config/env.js';
import { logger } from '../../shared/logger/index.js';
import { renderEmailTemplate } from './templates.js';

export * from './templates.js';

export interface EmailProvider {
  sendPasswordReset(target: string, code: string, language?: Language): Promise<void>;
  sendMessage(target: string, subject: string, htmlContent: string): Promise<void>;
  sendTemplate(
    target: string,
    templateKey: string,
    params: Record<string, unknown>,
    language?: Language,
  ): Promise<void>;
}

export class SmtpEmailProvider implements EmailProvider {
  private transporter: Transporter;

  constructor() {
    this.transporter = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_PORT === 465,
      auth:
        env.SMTP_USER && env.SMTP_PASS
          ? {
              user: env.SMTP_USER,
              pass: env.SMTP_PASS,
            }
          : undefined,
    });
  }

  async sendPasswordReset(target: string, code: string, language: Language = 'en'): Promise<void> {
    const subject = language === 'hi' ? 'पासवर्ड रीसेट कोड' : 'Password Reset Code';
    const html = `<p>Your password reset OTP is: <strong>${code}</strong>. Valid for 10 minutes.</p>`;
    await this.sendMessage(target, subject, html);
  }

  async sendMessage(target: string, subject: string, htmlContent: string): Promise<void> {
    try {
      const info = await this.transporter.sendMail({
        from: env.EMAIL_FROM,
        to: target,
        subject,
        html: htmlContent,
      });
      logger.info({ messageId: info.messageId, target, subject }, '[SmtpEmailProvider] Email sent');
    } catch (err) {
      logger.error({ err, target, subject }, '[SmtpEmailProvider] Failed to send email');
      throw err;
    }
  }

  async sendTemplate(
    target: string,
    templateKey: string,
    params: Record<string, unknown>,
    _language: Language = 'en',
  ): Promise<void> {
    const { subject, html } = renderEmailTemplate(templateKey, params);
    await this.sendMessage(target, subject, html);
  }
}

export class DevEmailProvider implements EmailProvider {
  private smtpFallback: SmtpEmailProvider | null = null;

  constructor() {
    // If SMTP host is reachable / dev MailHog is configured, also deliver to MailHog
    try {
      this.smtpFallback = new SmtpEmailProvider();
    } catch {
      this.smtpFallback = null;
    }
  }

  async sendPasswordReset(target: string, code: string, language: Language = 'en'): Promise<void> {
    if (env.NODE_ENV === 'production') {
      throw new Error('FATAL: DevEmailProvider cannot be used in production environment!');
    }

    const banner = [
      '==============================================================',
      ' [DEV ONLY] EMAIL PASSWORD RESET DISPATCHED',
      ` Recipient: ${target}`,
      ` Reset OTP: ${code}`,
      ` Language:  ${language}`,
      '==============================================================',
    ].join('\n');

    process.stdout.write(`\n${banner}\n\n`);
    logger.info({ target, language }, '[DevEmailProvider] Password reset email dispatched to console');

    if (this.smtpFallback) {
      this.smtpFallback.sendPasswordReset(target, code, language).catch((err) => {
        logger.debug({ err: err?.message }, '[DevEmailProvider] MailHog delivery skipped');
      });
    }
  }

  async sendMessage(target: string, subject: string, htmlContent: string): Promise<void> {
    if (env.NODE_ENV === 'production') {
      throw new Error('FATAL: DevEmailProvider cannot be used in production environment!');
    }
    logger.info({ target, subject }, '[DevEmailProvider] Email dispatched to console');

    if (this.smtpFallback) {
      this.smtpFallback.sendMessage(target, subject, htmlContent).catch((err) => {
        logger.debug({ err: err?.message }, '[DevEmailProvider] MailHog delivery skipped');
      });
    }
  }

  async sendTemplate(
    target: string,
    templateKey: string,
    params: Record<string, unknown>,
    language: Language = 'en',
  ): Promise<void> {
    if (env.NODE_ENV === 'production') {
      throw new Error('FATAL: DevEmailProvider cannot be used in production environment!');
    }

    const { subject, html } = renderEmailTemplate(templateKey, params);
    const banner = [
      '==============================================================',
      ' [DEV ONLY] TEMPLATED EMAIL DISPATCHED',
      ` Recipient:   ${target}`,
      ` Template:    ${templateKey}`,
      ` Subject:     ${subject}`,
      ` Language:    ${language}`,
      '==============================================================',
    ].join('\n');

    process.stdout.write(`\n${banner}\n\n`);
    logger.info({ target, templateKey, subject }, '[DevEmailProvider] Template email dispatched');

    if (this.smtpFallback) {
      this.smtpFallback.sendTemplate(target, templateKey, params, language).catch((err) => {
        logger.debug({ err: err?.message }, '[DevEmailProvider] MailHog delivery skipped');
      });
    }
  }
}

export class NoopEmailProvider implements EmailProvider {
  async sendPasswordReset(target: string, _code: string, language: Language = 'en'): Promise<void> {
    logger.debug({ target, language }, '[NoopEmailProvider] sendPasswordReset called (no-op)');
  }

  async sendMessage(target: string, subject: string, _htmlContent: string): Promise<void> {
    logger.debug({ target, subject }, '[NoopEmailProvider] sendMessage called (no-op)');
  }

  async sendTemplate(
    target: string,
    templateKey: string,
    _params: Record<string, unknown>,
    language: Language = 'en',
  ): Promise<void> {
    logger.debug({ target, templateKey, language }, '[NoopEmailProvider] sendTemplate called (no-op)');
  }
}

let emailProviderInstance: EmailProvider | null = null;

export function getEmailProvider(): EmailProvider {
  if (!emailProviderInstance) {
    if (env.EMAIL_PROVIDER === 'smtp') {
      emailProviderInstance = new SmtpEmailProvider();
    } else if (env.EMAIL_PROVIDER === 'dev') {
      emailProviderInstance = new DevEmailProvider();
    } else {
      emailProviderInstance = new NoopEmailProvider();
    }
  }
  return emailProviderInstance;
}
