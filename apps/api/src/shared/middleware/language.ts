import type { Request, Response, NextFunction } from 'express';
import { DEFAULT_LANGUAGE, LANGUAGES, type Language } from '@ap/shared-constants';

export function languageMiddleware(req: Request, _res: Response, next: NextFunction): void {
  const header = req.headers['accept-language'];
  if (typeof header === 'string') {
    const primary = header.split(',')[0]?.split(';')[0]?.trim().toLowerCase();
    if (primary?.startsWith('hi')) {
      req.language = LANGUAGES.HI;
    } else if (primary?.startsWith('gu')) {
      req.language = LANGUAGES.GU;
    } else {
      req.language = LANGUAGES.EN;
    }
  } else {
    req.language = DEFAULT_LANGUAGE as Language;
  }
  next();
}
