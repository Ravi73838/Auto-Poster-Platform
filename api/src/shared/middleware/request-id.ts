import type { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'node:crypto';

export function requestIdMiddleware(req: Request, res: Response, next: NextFunction): void {
  const existingId = req.headers['x-request-id'];
  const id = typeof existingId === 'string' && existingId.trim().length > 0 ? existingId : randomUUID();
  req.id = id;
  res.setHeader('x-request-id', id);
  next();
}

