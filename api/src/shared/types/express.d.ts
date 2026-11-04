import type { Language, Role, AccountStatus } from '@ap/shared-constants';

export interface RequestAuth {
  userId: string;
  role: Role;
  status: AccountStatus;
  sessionId: string;
  permissions: string[];
  stepUpVerifiedAt?: Date | null;
}

declare global {
  namespace Express {
    interface Request {
      id?: string;
      language?: Language;
      auth?: RequestAuth;
    }
  }
}


