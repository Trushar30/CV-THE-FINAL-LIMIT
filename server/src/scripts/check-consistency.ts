#!/usr/bin/env node
import { config as dotenvConfig } from 'dotenv';
dotenvConfig();

import { connectDatabase, disconnectDatabase } from '../config/database.js';
import { consistencyChecker } from '../utils/consistencyChecker.js';
import { logger } from '../utils/logger.js';

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const shouldFix = args.includes('--fix');
  const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/corpverse';

  logger.info(`[CheckConsistency] Connecting to MongoDB (${mongoUri})...`);

  try {
    await connectDatabase(mongoUri);

    const result = await consistencyChecker.runAudit({ fix: shouldFix });

    console.log('\n======================================================');
    console.log('       CORPVERSE DATA INTEGRITY AUDIT REPORT           ');
    console.log('======================================================');
    console.log(`Timestamp: ${result.timestamp}`);
    console.log(`Users Checked: ${result.totalUsersChecked}`);
    console.log(`EXP Mismatches: ${result.expMismatches.length}`);
    console.log(`CorpCoin Mismatches: ${result.corpCoinMismatches.length}`);
    console.log(`Total Orphan Records: ${result.totalOrphansFound}`);
    console.log(`Overall Status: ${result.isConsistent ? 'PASS (100% Consistent)' : 'FAIL (Inconsistencies Detected)'}`);
    console.log('------------------------------------------------------');

    if (result.expMismatches.length > 0) {
      console.log('\n[EXP MISMATCHES]');
      console.table(result.expMismatches);
    }

    if (result.corpCoinMismatches.length > 0) {
      console.log('\n[CORPCOIN MISMATCHES]');
      console.table(result.corpCoinMismatches);
    }

    if (result.totalOrphansFound > 0) {
      console.log('\n[ORPHAN RECORDS BY COLLECTION]');
      console.table(
        Object.entries(result.orphanReports).map(([coll, report]) => ({
          collection: coll,
          orphans: report.count,
          samples: report.sampleIds.join(', ') || 'None',
        }))
      );
    }

    console.log('======================================================\n');

    await disconnectDatabase();
    process.exit(result.isConsistent ? 0 : 1);
  } catch (error) {
    logger.error('[CheckConsistency] Fatal error running consistency audit', {
      error: error instanceof Error ? error.message : String(error),
    });
    try {
      await disconnectDatabase();
    } catch {
      // ignore
    }
    process.exit(1);
  }
}

void main();
