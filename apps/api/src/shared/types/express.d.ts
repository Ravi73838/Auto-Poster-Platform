import type { Language } from '@ap/shared-constants';

declare global {
  namespace Express {
    interface Request {
      id?: string;
      language?: Language;
    }
  }
}
