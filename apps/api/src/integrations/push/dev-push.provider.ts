import { type PushProvider, type PushMessage, type PushTicket } from './push.interface.js';
import { logger } from '../../shared/logger/index.js';
import { env } from '../../config/env.js';

export class DevPushProvider implements PushProvider {
  async send(messages: PushMessage[]): Promise<PushTicket[]> {
    if (env.NODE_ENV === 'production') {
      throw new Error('FATAL: DevPushProvider cannot be used in production environment!');
    }

    const tickets: PushTicket[] = [];

    for (const msg of messages) {
      const recipients = Array.isArray(msg.to) ? msg.to.join(', ') : msg.to;
      const banner = [
        '==============================================================',
        ' [DEV ONLY] PUSH NOTIFICATION DISPATCHED',
        ` Recipient(s): ${recipients}`,
        ` Title:        ${msg.title}`,
        ` Body:         ${msg.body}`,
        ` Data:         ${JSON.stringify(msg.data ?? {})}`,
        '==============================================================',
      ].join('\n');

      process.stdout.write(`\n${banner}\n\n`);
      logger.info({ to: msg.to, title: msg.title }, '[DevPushProvider] Push dispatched to console');

      tickets.push({
        id: `dev-ticket-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        status: 'ok',
      });
    }

    return tickets;
  }
}

export class NoopPushProvider implements PushProvider {
  async send(messages: PushMessage[]): Promise<PushTicket[]> {
    return messages.map(() => ({
      id: `noop-ticket-${Date.now()}`,
      status: 'ok',
    }));
  }
}

