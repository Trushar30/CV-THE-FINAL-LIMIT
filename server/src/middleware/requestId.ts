import { randomUUID } from 'node:crypto';
import type { Request, Response, NextFunction } from 'express';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      id?: string;
    }
  }
}

export function requestIdMiddleware(req: Request, res: Response, next: NextFunction): void {
  const existingId = req.header('x-request-id');
  const id = existingId && existingId.trim() !== '' ? existingId : randomUUID();

  req.id = id;
  res.setHeader('x-request-id', id);

  next();
}
