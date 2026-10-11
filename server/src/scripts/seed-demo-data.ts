#!/usr/bin/env node
/**
 * CorpVerse Demo Data Seeder
 * Idempotently seeds clearly flagged simulation personas across all roles:
 * - Admin (admin@corpverse.dev)
 * - AI Manager (aimanager@corpverse.dev)
 * - Candidate / Job Seeker (alex.chen@corpverse.dev)
 * - Employed Engineer (employee@corpverse.dev)
 * - Corporate Founder (founder@corpverse.dev)
 *
 * Usage:
 *   npm run seed:demo
 *   npx tsx src/scripts/seed-demo-data.ts
 */

import argon2 from 'argon2';
import mongoose from 'mongoose';
import { connectDatabase, disconnectDatabase } from '../config/database.js';
import { UserModel } from '../models/User.js';
import { ProfileModel } from '../models/Profile.js';
import { CompanyModel } from '../models/Company.js';
import { CompanyEmployeeModel } from '../models/CompanyEmployee.js';
import { CompanyBotModel } from '../models/CompanyBot.js';
import { CompanyJobModel } from '../models/CompanyJob.js';
import { FounderModel } from '../models/Founder.js';
import { ExpTransactionModel } from '../models/ExpTransaction.js';
import { CorpCoinTransactionModel } from '../models/CorpCoinTransaction.js';
import { EmployeeTaskModel } from '../models/EmployeeTask.js';
import { domainService } from '../services/domain/domain.service.js';
import { configService } from '../services/config/config.service.js';
import { companyService } from '../services/company/company.service.js';
import { logger } from '../utils/logger.js';

interface SeededAccount {
  role: string;
  email: string;
  pass: string;
  name: string;
  notes: string;
}

const SEEDED_CREDENTIALS: SeededAccount[] = [];

async function seedDemoData(): Promise<void> {
  console.log('\n======================================================');
  console.log('       CorpVerse Demo Data Seeding Engine');
  console.log('======================================================\n');

  await connectDatabase();

  // 1. Ensure Baseline Platform Entities
  console.log('🌱 1. Checking baseline platform config, domains, and companies...');
  await configService.seedDefaultsIfMissing();
  await domainService.seedDefaultDomains();
  await domainService.seedDefaultSkills();
  await companyService.seedPlatformCompanies();

  // Fetch a platform company for employee placement
  const platformCompany = await CompanyModel.findOne({ isPlatformCompany: true, status: 'ACTIVE' });
  if (!platformCompany) {
    throw new Error('Platform companies could not be initialized');
  }

  // 2. Seed Administrator Account
  console.log('👑 2. Seeding Platform Administrator...');
  const adminEmail = 'admin@corpverse.dev';
  const adminPass = 'Admin@1234';
  let admin = await UserModel.findOne({ email: adminEmail });
  if (!admin) {
    const hash = await argon2.hash(adminPass);
    admin = await UserModel.create({
      email: adminEmail,
      passwordHash: hash,
      platformRole: 'ADMIN',
      careerRole: 'NONE',
      status: 'ACTIVE',
      emailVerified: true,
      isEmailVerified: true,
      onboardingStep: 'COMPLETED',
      totalExp: 0,
      totalExpCached: 0,
      corpCoinBalance: 0,
      corpCoinBalanceCached: 0,
      founderStarterCoinGranted: false,
    });
    await ProfileModel.create({
      userId: admin._id,
      displayName: 'System Administrator (Demo)',
      domain: 'SOFTWARE_ENGINEERING',
      skills: ['DevOps', 'Security', 'Architecture', 'Kubernetes'],
      bio: 'Platform root administration and security overseer [DEMO DATA].',
    });
    console.log('   ✓ Created admin@corpverse.dev');
  } else {
    console.log('   • admin@corpverse.dev already exists');
  }
  SEEDED_CREDENTIALS.push({
    role: 'ADMIN',
    email: adminEmail,
    pass: adminPass,
    name: 'System Administrator',
    notes: 'Access to /admin, platform config, audit logs, and demo triggers.',
  });

  // 3. Seed AI Manager Account
  console.log('🤖 3. Seeding AI Infrastructure Manager...');
  const aiManagerEmail = 'aimanager@corpverse.dev';
  const aiManagerPass = 'AiManager@1234';
  let aiManager = await UserModel.findOne({ email: aiManagerEmail });
  if (!aiManager) {
    const hash = await argon2.hash(aiManagerPass);
    aiManager = await UserModel.create({
      email: aiManagerEmail,
      passwordHash: hash,
      platformRole: 'AI_MANAGER',
      careerRole: 'NONE',
      status: 'ACTIVE',
      emailVerified: true,
      isEmailVerified: true,
      onboardingStep: 'COMPLETED',
      totalExp: 0,
      totalExpCached: 0,
      corpCoinBalance: 0,
      corpCoinBalanceCached: 0,
      founderStarterCoinGranted: false,
    });
    await ProfileModel.create({
      userId: aiManager._id,
      displayName: 'AI Operations Director (Demo)',
      domain: 'AI_ENGINEERING',
      skills: ['LLM Orchestration', 'Prompt Engineering', 'LangChain', 'Python', 'Vector DBs'],
      bio: 'LLM infrastructure and multi-provider failover director [DEMO DATA].',
    });
    console.log('   ✓ Created aimanager@corpverse.dev');
  } else {
    console.log('   • aimanager@corpverse.dev already exists');
  }
  SEEDED_CREDENTIALS.push({
    role: 'AI_MANAGER',
    email: aiManagerEmail,
    pass: aiManagerPass,
    name: 'AI Operations Director',
    notes: 'Access to /admin/ai-health, provider status, and queue load telemetry.',
  });

  // 4. Seed Job Seeker Candidate (Alex Chen)
  console.log('👤 4. Seeding Job Seeker Candidate (Alex Chen)...');
  const candidateEmail = 'alex.chen@corpverse.dev';
  const candidatePass = 'Candidate@1234';
  let candidate = await UserModel.findOne({ email: candidateEmail });
  if (!candidate) {
    const hash = await argon2.hash(candidatePass);
    candidate = await UserModel.create({
      email: candidateEmail,
      passwordHash: hash,
      platformRole: 'NONE',
      careerRole: 'JOB_SEEKER',
      status: 'ACTIVE',
      emailVerified: true,
      isEmailVerified: true,
      onboardingStep: 'COMPLETED',
      totalExp: 250,
      totalExpCached: 250,
      corpCoinBalance: 0,
      corpCoinBalanceCached: 0,
      founderStarterCoinGranted: false,
    });
    await ProfileModel.create({
      userId: candidate._id,
      displayName: 'Alex Chen (Demo Candidate)',
      domain: 'SOFTWARE_ENGINEERING',
      skills: ['TypeScript', 'Node.js', 'PostgreSQL', 'Docker', 'System Design'],
      bio: 'Distributed systems backend engineer seeking high-impact platform roles [DEMO DATA].',
      githubUrl: 'https://github.com/alexchen-corpverse',
      linkedinUrl: 'https://linkedin.com/in/alexchen-corpverse',
    });
    console.log('   ✓ Created alex.chen@corpverse.dev');
  } else {
    console.log('   • alex.chen@corpverse.dev already exists');
  }
  SEEDED_CREDENTIALS.push({
    role: 'JOB_SEEKER',
    email: candidateEmail,
    pass: candidatePass,
    name: 'Alex Chen',
    notes: 'Onboarded candidate ready to apply for open requisitions in /jobs.',
  });

  // 5. Seed Employed Engineer with Tasks & Ledger
  console.log('💼 5. Seeding Employed Engineer (Sarah Connor)...');
  const employeeEmail = 'employee@corpverse.dev';
  const employeePass = 'Employee@1234';
  let employee = await UserModel.findOne({ email: employeeEmail });
  if (!employee) {
    const hash = await argon2.hash(employeePass);
    employee = await UserModel.create({
      email: employeeEmail,
      passwordHash: hash,
      platformRole: 'NONE',
      careerRole: 'EMPLOYEE',
      status: 'ACTIVE',
      emailVerified: true,
      isEmailVerified: true,
      onboardingStep: 'COMPLETED',
      totalExp: 1500,
      totalExpCached: 1500,
      corpCoinBalance: 0,
      corpCoinBalanceCached: 0,
      founderStarterCoinGranted: false,
    });
    await ProfileModel.create({
      userId: employee._id,
      displayName: 'Sarah Connor (Staff Engineer)',
      domain: 'SOFTWARE_ENGINEERING',
      skills: ['Go', 'TypeScript', 'Distributed Systems', 'PostgreSQL', 'Redis'],
      bio: 'Core infrastructure engineer currently building high-throughput event buses [DEMO DATA].',
    });

    // Create Company Employee Placement
    await CompanyEmployeeModel.create({
      companyId: platformCompany._id,
      userId: employee._id,
      level: 3,
      positionTitle: 'Junior+ Software Engineer',
      status: 'ACTIVE',
      startedAt: new Date(Date.now() - 14 * 86400000),
    });

    // Seed EXP Transactions Ledger
    await ExpTransactionModel.create({
      userId: employee._id,
      amount: 1500,
      balanceAfter: 1500,
      reason: 'TASK_COMPLETION',
      sourceId: new mongoose.Types.ObjectId(),
      metadata: { note: 'Initial seeded task performance awards' },
    });

    // Seed Sample Daily Task & Performance
    await EmployeeTaskModel.create({
      userId: employee._id,
      companyId: platformCompany._id,
      title: 'Optimize Event Ingestion Pipeline Throughput',
      scenario: 'High latency observed under 10k RPS traffic spikes. Propose partitioned consumer group rebalancing.',
      difficulty: 'MEDIUM',
      domain: 'SOFTWARE_ENGINEERING',
      maxExp: 60,
      status: 'COMPLETED',
      isBonusTask: false,
      score: 85,
      awardedExp: 51,
      submission: 'Implemented ring-hash consistent partitioning with batch commit offsets to prevent consumer head-of-line blocking.',
      feedback: 'Excellent grasp of partition balancing and fault isolation.',
      evaluation: {
        score: 85,
        feedback: 'Solid concurrency design and bounded resource allocation.',
        strengths: ['Identified head-of-line blocking', 'Correctly applied consistent hashing'],
        improvements: ['Could benchmark memory consumption during node rebalances'],
      },
    });

    console.log(`   ✓ Created employee@corpverse.dev at ${platformCompany.name}`);
  } else {
    console.log('   • employee@corpverse.dev already exists');
  }
  SEEDED_CREDENTIALS.push({
    role: 'EMPLOYEE',
    email: employeeEmail,
    pass: employeePass,
    name: 'Sarah Connor',
    notes: `Active engineer at ${platformCompany.name} (L3 Junior+), with tasks at /workplace.`,
  });

  // 6. Seed Corporate Founder with Active Company & Bots
  console.log('🏢 6. Seeding Enterprise Founder (Marcus Vance)...');
  const founderEmail = 'founder@corpverse.dev';
  const founderPass = 'Founder@1234';
  let founderUser = await UserModel.findOne({ email: founderEmail });
  if (!founderUser) {
    const hash = await argon2.hash(founderPass);
    founderUser = await UserModel.create({
      email: founderEmail,
      passwordHash: hash,
      platformRole: 'NONE',
      careerRole: 'FOUNDER',
      status: 'ACTIVE',
      emailVerified: true,
      isEmailVerified: true,
      onboardingStep: 'COMPLETED',
      totalExp: 14500,
      totalExpCached: 14500,
      corpCoinBalance: 150,
      corpCoinBalanceCached: 150,
      founderModeUnlockedAt: new Date(Date.now() - 30 * 86400000),
      founderStarterCoinGranted: true,
    });

    await ProfileModel.create({
      userId: founderUser._id,
      displayName: 'Marcus Vance (Founder & CEO)',
      domain: 'SOFTWARE_ENGINEERING',
      skills: ['Distributed Systems', 'Cloud Architecture', 'Strategic Management', 'FinTech'],
      bio: 'Serial corporate architect and founder of Vanguard Distributed Labs [DEMO DATA].',
    });

    // Create Founder Profile
    const founderProfile = await FounderModel.create({
      userId: founderUser._id,
      status: 'ACTIVE',
      unlockedAt: new Date(Date.now() - 30 * 86400000),
      starterCoinsGranted: 1000,
    });

    // Create Founder Company
    const founderCompany = await CompanyModel.create({
      name: 'Vanguard Distributed Labs (Demo)',
      founderId: founderUser._id,
      domain: 'SOFTWARE_ENGINEERING',
      description: 'Enterprise distributed consensus and fault-tolerant cloud engines [DEMO DATA].',
      status: 'ACTIVE',
      financialHealth: 850,
      corpCoinBalance: 2500,
      employeeCount: 1,
      isOpenForHiring: true,
      isPlatformCompany: false,
      aiProviderPool: 'MOCK',
    });

    founderProfile.companyId = founderCompany._id;
    await founderProfile.save();

    // Purchase 3 Basic Bots (Hiring, Task, Evaluation)
    await CompanyBotModel.create([
      { companyId: founderCompany._id, botType: 'BASIC_HIRING', tier: 'BASIC', purchaseCost: 250, isActive: true },
      { companyId: founderCompany._id, botType: 'BASIC_TASK', tier: 'BASIC', purchaseCost: 250, isActive: true },
      { companyId: founderCompany._id, botType: 'BASIC_EVALUATION', tier: 'BASIC', purchaseCost: 250, isActive: true },
    ]);

    // Open Requisition
    await CompanyJobModel.create({
      companyId: founderCompany._id,
      title: 'Senior Distributed Systems Architect',
      domain: 'SOFTWARE_ENGINEERING',
      description: 'Lead engineering for Byzantine fault-tolerant ledger replication kernels.',
      minLevel: 5,
      maxLevel: 8,
      status: 'OPEN',
      isOpen: true,
      slots: 2,
    });

    // Record Double-Entry CorpCoin Ledger Entries
    await CorpCoinTransactionModel.create([
      {
        userId: founderUser._id,
        amount: 1000,
        balanceAfter: 1000,
        type: 'FOUNDER_STARTER_GRANT',
        referenceId: founderProfile._id.toString(),
        description: 'Starter capital allocation upon unlocking Founder Mode',
      },
      {
        userId: founderUser._id,
        amount: -100,
        balanceAfter: 900,
        type: 'COMPANY_CREATION',
        referenceId: founderCompany._id.toString(),
        description: 'Incorporation statutory fee for Vanguard Distributed Labs',
      },
      {
        userId: founderUser._id,
        amount: -750,
        balanceAfter: 150,
        type: 'BOT_PURCHASE',
        referenceId: founderCompany._id.toString(),
        description: 'Store acquisition of 3 Basic Corporate Autonomous Bots',
      },
    ]);

    console.log(`   ✓ Created founder@corpverse.dev with company ${founderCompany.name}`);
  } else {
    console.log('   • founder@corpverse.dev already exists');
  }
  SEEDED_CREDENTIALS.push({
    role: 'FOUNDER',
    email: founderEmail,
    pass: founderPass,
    name: 'Marcus Vance',
    notes: 'Founder of Vanguard Distributed Labs, 3 bots owned, active company at /founder.',
  });

  console.log('\n======================================================');
  console.log('       SEEDED DEMO PERSONAS & CREDENTIALS');
  console.log('======================================================\n');
  console.table(SEEDED_CREDENTIALS);

  console.log('All personas have been verified and seeded idempotently.');
  console.log('You can now log in at http://localhost:3000/login\n');

  await disconnectDatabase();
}

seedDemoData()
  .then(() => {
    process.exit(0);
  })
  .catch((err) => {
    logger.error('Fatal seed failure:', err);
    process.exit(1);
  });
