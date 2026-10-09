import { applicationService } from '../services/career/application.service.js';
import { logger } from '../utils/logger.js';

export interface ApplicationExpiryJobOptions {
  staleDays?: number;
}

/**
 * Background / scheduled job to expire stale job applications.
 * Can be run on schedule or invoked on-demand.
 */
export async function runApplicationExpiryJob(
  options?: ApplicationExpiryJobOptions
): Promise<{ expiredCount: number; expiredApplicationIds: string[] }> {
  const staleDays = options?.staleDays ?? 30;
  logger.info('[ApplicationExpiryJob] Starting stale applications cleanup', { staleDays });

  try {
    const result = await applicationService.expireStaleApplications(staleDays);
    logger.info('[ApplicationExpiryJob] Cleanup complete', result);
    return result;
  } catch (err) {
    logger.error('[ApplicationExpiryJob] Error running application expiry job', {
      error: (err as Error).message,
    });
    throw err;
  }
}
