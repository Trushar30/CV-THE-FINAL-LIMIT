import type { Server } from 'node:http';
import { createApp } from './app.js';
import { env } from './config/env.js';
import { connectDatabase, registerGracefulShutdown } from './config/database.js';
import { domainService } from './services/domain/domain.service.js';
import { configService } from './services/config/config.service.js';
import { companyService } from './services/company/company.service.js';
import { defaultAIWorker } from './ai/index.js';
import { defaultAIManagerService } from './routes/aiManager.routes.js';
import './services/resume/resumeAnalysis.service.js';
import './services/career/atsScreening.service.js';
import './services/career/stageEngine.service.js';
import { logger } from './utils/logger.js';

const app = createApp();

let server: Server | null = null;

async function bootstrap(): Promise<void> {
  try {
    // Attempt MongoDB connection
    try {
      await connectDatabase();
      await domainService.seedDefaultDomains();
      await domainService.seedDefaultSkills();
      await configService.seedDefaultsIfMissing();
      await defaultAIManagerService.seedDemoPoolFromEnv();
      await companyService.seedPlatformCompanies();
      defaultAIWorker.start();
    } catch (dbErr) {
      logger.warn(
        `[Server] Starting server with degraded database connectivity: ${(dbErr as Error).message}`
      );
    }

    server = app.listen(env.PORT, () => {
      logger.info(`[CorpVerse Server] Listening on port ${env.PORT} in ${env.NODE_ENV} mode`);
      logger.info(`[CorpVerse Server] Health endpoint: http://localhost:${env.PORT}/api/health`);
    });

    registerGracefulShutdown(async () => {
      defaultAIWorker.stop();
      if (server) {
        await new Promise<void>((resolve, reject) => {
          server?.close((err) => (err ? reject(err) : resolve()));
        });
        logger.info('[Server] HTTP listener closed');
      }
    });
  } catch (error) {
    logger.error(`[Server] Fatal bootstrap error: ${(error as Error).message}`);
    process.exit(1);
  }
}

process.on('uncaughtException', (err: Error) => {
  logger.error(`[Process] Uncaught Exception: ${err.message}`, { stack: err.stack });
  process.exit(1);
});

process.on('unhandledRejection', (reason: unknown) => {
  logger.error(`[Process] Unhandled Rejection: ${String(reason)}`);
  process.exit(1);
});

void bootstrap();
