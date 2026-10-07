import { Router, type Request, type Response } from 'express';
import { getDatabaseState } from '../config/database.js';

export const healthRouter = Router();

healthRouter.get('/health', (_req: Request, res: Response) => {
  const dbState = getDatabaseState();
  const isHealthy = dbState.connected;

  res.status(200).json({
    status: isHealthy ? 'healthy' : 'degraded',
    service: 'corpverse-server',
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor(process.uptime()),
    database: dbState,
  });
});
