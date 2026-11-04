export interface PushMessage {
  to: string | string[];
  title: string;
  body: string;
  data?: Record<string, unknown>;
  sound?: string;
  badge?: number;
  channelId?: string;
  priority?: 'default' | 'normal' | 'high';
}

export interface PushTicket {
  id?: string;
  status: 'ok' | 'error';
  message?: string;
  details?: {
    error?:
      | 'DeviceNotRegistered'
      | 'InvalidCredentials'
      | 'MessageTooBig'
      | 'MessageRateExceeded'
      | string;
  };
}

export interface PushReceipt {
  status: 'ok' | 'error';
  message?: string;
  details?: { error?: string };
}

export interface PushProvider {
  send(messages: PushMessage[]): Promise<PushTicket[]>;
  getReceipts?(receiptIds: string[]): Promise<Record<string, PushReceipt>>;
}

