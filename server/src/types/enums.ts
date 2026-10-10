/**
 * CorpVerse Master Enums and Core Role Types
 * Adhering strictly to GEMINI.md and docs/CORPVERSE_SPECIFICATION.md
 */

// Dual-role dimensions
export type CareerRole = 'JOB_SEEKER' | 'EMPLOYEE' | 'FOUNDER' | 'NONE';
export type PlatformRole = 'NONE' | 'ADMIN' | 'AI_MANAGER';

export const CAREER_ROLES: readonly CareerRole[] = [
  'JOB_SEEKER',
  'EMPLOYEE',
  'FOUNDER',
  'NONE',
] as const;
export const PLATFORM_ROLES: readonly PlatformRole[] = ['NONE', 'ADMIN', 'AI_MANAGER'] as const;

// User Account Status
export type UserStatus = 'ACTIVE' | 'SUSPENDED';
export const USER_STATUSES: readonly UserStatus[] = ['ACTIVE', 'SUSPENDED'] as const;

// Onboarding Steps
export type OnboardingStep =
  | 'REGISTERED'
  | 'EMAIL_VERIFIED'
  | 'NAME'
  | 'DOMAIN'
  | 'SKILLS'
  | 'RESUME'
  | 'REVIEW'
  | 'COMPLETE'
  | 'PROFILE_COMPLETED'; // Backwards compatibility

export const ONBOARDING_STEPS: readonly OnboardingStep[] = [
  'REGISTERED',
  'EMAIL_VERIFIED',
  'NAME',
  'DOMAIN',
  'SKILLS',
  'RESUME',
  'REVIEW',
  'COMPLETE',
  'PROFILE_COMPLETED',
] as const;

// Career Domains
export type CareerDomain = 'SOFTWARE_ENGINEERING' | 'CLOUD_ENGINEERING' | 'AI_ENGINEERING';
export const CAREER_DOMAINS: readonly CareerDomain[] = [
  'SOFTWARE_ENGINEERING',
  'CLOUD_ENGINEERING',
  'AI_ENGINEERING',
] as const;

// Company Types and Statuses (Spec Section 6 & 26.7)
export type CompanyType = 'PLATFORM' | 'FOUNDER';
export const COMPANY_TYPES: readonly CompanyType[] = ['PLATFORM', 'FOUNDER'] as const;

export type CompanyStatus = 'ACTIVE' | 'BANKRUPT' | 'SUSPENDED';
export const COMPANY_STATUSES: readonly CompanyStatus[] = [
  'ACTIVE',
  'BANKRUPT',
  'SUSPENDED',
] as const;

// Job Posting Status (Spec Section 6.3 & 26.10)
export type JobStatus = 'OPEN' | 'CLOSED';
export const JOB_STATUSES: readonly JobStatus[] = ['OPEN', 'CLOSED'] as const;

// Company Employee Statuses (Spec Section 6.2 & 26.8)
export type CompanyEmployeeStatus = 'ACTIVE' | 'TERMINATED' | 'DEMOTED' | 'UNDER_REVIEW';
export const COMPANY_EMPLOYEE_STATUSES: readonly CompanyEmployeeStatus[] = [
  'ACTIVE',
  'TERMINATED',
  'DEMOTED',
  'UNDER_REVIEW',
] as const;

// Task difficulty tiers and types
export type TaskDifficulty = 'EASY' | 'MEDIUM' | 'HARD';
export const TASK_DIFFICULTIES: readonly TaskDifficulty[] = ['EASY', 'MEDIUM', 'HARD'] as const;

export type TaskType = 'PRIMARY' | 'BONUS';
export const TASK_TYPES: readonly TaskType[] = ['PRIMARY', 'BONUS'] as const;

// Hiring application stages and statuses
export type ApplicationStage =
  | 'APPLIED'
  | 'ATS_SCREENING'
  | 'SCREENING'
  | 'ASSESSMENT'
  | 'INTERVIEW'
  | 'FINAL_REVIEW'
  | 'OFFER'
  | 'ACCEPTED';

export const APPLICATION_STAGES: readonly ApplicationStage[] = [
  'APPLIED',
  'ATS_SCREENING',
  'SCREENING',
  'ASSESSMENT',
  'INTERVIEW',
  'FINAL_REVIEW',
  'OFFER',
  'ACCEPTED',
] as const;

export type ApplicationStatus =
  | 'ACTIVE'
  | 'IN_PROGRESS'
  | 'REJECTED'
  | 'WITHDRAWN'
  | 'EXPIRED'
  | 'ACCEPTED';

export const APPLICATION_STATUSES: readonly ApplicationStatus[] = [
  'ACTIVE',
  'IN_PROGRESS',
  'REJECTED',
  'WITHDRAWN',
  'EXPIRED',
  'ACCEPTED',
] as const;

// Application Operating Mode (Spec Section 23, Decision D11, ADR-010)
export type ApplicationMode = 'PRODUCTION' | 'DEMO';
export const APPLICATION_MODES: readonly ApplicationMode[] = ['PRODUCTION', 'DEMO'] as const;

// AI Providers and infrastructure
export type AIProvider = 'gemini' | 'openai' | 'groq';
export const AI_PROVIDERS: readonly AIProvider[] = ['gemini', 'openai', 'groq'] as const;

export type ProviderHealthState =
  'HEALTHY' | 'DEGRADED' | 'RATE_LIMITED' | 'TEMPORARILY_FAILED' | 'DISABLED';

export const PROVIDER_HEALTH_STATES: readonly ProviderHealthState[] = [
  'HEALTHY',
  'DEGRADED',
  'RATE_LIMITED',
  'TEMPORARILY_FAILED',
  'DISABLED',
] as const;

export type AIJobStatus =
  | 'PENDING'
  | 'PROCESSING'
  | 'COMPLETED'
  | 'FAILED'
  | 'RETRYING'
  | 'WAITING_FOR_PROVIDER'
  | 'CANCELLED';

export const AI_JOB_STATUSES: readonly AIJobStatus[] = [
  'PENDING',
  'PROCESSING',
  'COMPLETED',
  'FAILED',
  'RETRYING',
  'WAITING_FOR_PROVIDER',
  'CANCELLED',
] as const;

// Audit Actor Role
export type AuditActorRole = 'ADMIN' | 'AI_MANAGER';
export const AUDIT_ACTOR_ROLES: readonly AuditActorRole[] = ['ADMIN', 'AI_MANAGER'] as const;

// EXP Ledger Transaction Types (Spec Section 27)
export type ExpTransactionType = 'TASK_COMPLETION' | 'ADMIN_ADJUSTMENT';
export const EXP_TRANSACTION_TYPES: readonly ExpTransactionType[] = [
  'TASK_COMPLETION',
  'ADMIN_ADJUSTMENT',
] as const;

// CorpCoin Ledger Transaction Types (Spec Section 28)
export type CorpCoinTransactionType =
  | 'FOUNDER_STARTER_GRANT'
  | 'COMPANY_CREATION'
  | 'BOT_PURCHASE'
  | 'BUSINESS_REVENUE'
  | 'BUSINESS_EXPENSE'
  | 'ADMIN_ADJUSTMENT';

export const CORP_COIN_TRANSACTION_TYPES: readonly CorpCoinTransactionType[] = [
  'FOUNDER_STARTER_GRANT',
  'COMPANY_CREATION',
  'BOT_PURCHASE',
  'BUSINESS_REVENUE',
  'BUSINESS_EXPENSE',
  'ADMIN_ADJUSTMENT',
] as const;

// Notification Types (Spec Section 24 & 26.36)
export type NotificationType =
  | 'STAGE_ADVANCED'
  | 'APPLICATION_REJECTED'
  | 'OFFER_RECEIVED'
  | 'HIRED'
  | 'APPLICATION_EXPIRED'
  | 'TASK_ASSIGNED'
  | 'TASK_EVALUATED'
  | 'WARNING_ISSUED'
  | 'WARNING_EXPIRING_SOON'
  | 'PROMOTION'
  | 'DEMOTION'
  | 'TERMINATION'
  | 'FOUNDER_UNLOCKED'
  | 'COMPANY_BANKRUPT'
  | 'DAILY_SCENARIO_READY'
  | 'LOW_BALANCE_WARNING'
  | 'AI_RESULT_READY'
  | 'SYSTEM_ANNOUNCEMENT';

export const NOTIFICATION_TYPES: readonly NotificationType[] = [
  'STAGE_ADVANCED',
  'APPLICATION_REJECTED',
  'OFFER_RECEIVED',
  'HIRED',
  'APPLICATION_EXPIRED',
  'TASK_ASSIGNED',
  'TASK_EVALUATED',
  'WARNING_ISSUED',
  'WARNING_EXPIRING_SOON',
  'PROMOTION',
  'DEMOTION',
  'TERMINATION',
  'FOUNDER_UNLOCKED',
  'COMPANY_BANKRUPT',
  'DAILY_SCENARIO_READY',
  'LOW_BALANCE_WARNING',
  'AI_RESULT_READY',
  'SYSTEM_ANNOUNCEMENT',
] as const;

// Company Simulation & Scenario Enums (Spec Collections 24 & 25, SIMULATION_DESIGN.md)
export type CompanyScenarioStatus = 'ACTIVE' | 'DECIDED' | 'EXPIRED';
export const COMPANY_SCENARIO_STATUSES: readonly CompanyScenarioStatus[] = [
  'ACTIVE',
  'DECIDED',
  'EXPIRED',
] as const;

export type ScenarioCategory =
  | 'PRODUCT'
  | 'ENGINEERING'
  | 'CLIENT'
  | 'CULTURE'
  | 'FINANCE';
export const SCENARIO_CATEGORIES: readonly ScenarioCategory[] = [
  'PRODUCT',
  'ENGINEERING',
  'CLIENT',
  'CULTURE',
  'FINANCE',
] as const;

export type ScenarioOptionId = 'A' | 'B' | 'C' | 'D';
export const SCENARIO_OPTION_IDS: readonly ScenarioOptionId[] = ['A', 'B', 'C', 'D'] as const;

// Founder Statuses (Spec Section 26.23)
export type FounderStatus = 'ACTIVE' | 'BANKRUPT' | 'RETIRED';
export const FOUNDER_STATUSES: readonly FounderStatus[] = [
  'ACTIVE',
  'BANKRUPT',
  'RETIRED',
] as const;

// Performance Score Bands (GEMINI.md Section 5 & Spec Section 11.1)
export type PerformanceBand =
  | 'POOR'
  | 'NEEDS_IMPROVEMENT'
  | 'ACCEPTABLE'
  | 'GOOD'
  | 'EXCELLENT';

export const PERFORMANCE_BANDS: readonly PerformanceBand[] = [
  'POOR',
  'NEEDS_IMPROVEMENT',
  'ACCEPTABLE',
  'GOOD',
  'EXCELLENT',
] as const;

export type PerformanceBandLabel =
  | 'Poor'
  | 'Needs Improvement'
  | 'Acceptable'
  | 'Good'
  | 'Excellent';

// Employee Task Types & Difficulties (Spec Section 9, 26.17, GEMINI.md Section 5)
export type TaskKind = TaskType;
export const TASK_KINDS = TASK_TYPES;

export type EmployeeTaskStatus =
  | 'ASSIGNED'
  | 'IN_PROGRESS'
  | 'SUBMITTED'
  | 'EVALUATED'
  | 'EXPIRED'
  | 'WAITING_FOR_PROVIDER';

export const EMPLOYEE_TASK_STATUSES: readonly EmployeeTaskStatus[] = [
  'ASSIGNED',
  'IN_PROGRESS',
  'SUBMITTED',
  'EVALUATED',
  'EXPIRED',
  'WAITING_FOR_PROVIDER',
] as const;

// Discipline & Review Enums (Spec Sections 11 & 26.20–26.22)
export type WarningStatus = 'ACTIVE' | 'EXPIRED' | 'RESOLVED' | 'ESCALATED';
export const WARNING_STATUSES: readonly WarningStatus[] = [
  'ACTIVE',
  'EXPIRED',
  'RESOLVED',
  'ESCALATED',
] as const;

export type EmploymentReviewDecision = 'DEMOTION' | 'TERMINATION';
export const EMPLOYMENT_REVIEW_DECISIONS: readonly EmploymentReviewDecision[] = [
  'DEMOTION',
  'TERMINATION',
] as const;

// Company Bot Enums (Spec Sections 13, 26 Collection 9)
export type CompanyBotType = 'HIRING_BOT' | 'TASK_BOT' | 'EVALUATION_BOT';
export const COMPANY_BOT_TYPES: readonly CompanyBotType[] = [
  'HIRING_BOT',
  'TASK_BOT',
  'EVALUATION_BOT',
] as const;

export type CompanyBotTier = 'BASIC' | 'ADVANCED';
export const COMPANY_BOT_TIERS: readonly CompanyBotTier[] = [
  'BASIC',
  'ADVANCED',
] as const;

// Leaderboard Categories & Periods (Spec Section 15, 22, 26 Collection 35)
export type LeaderboardCategory =
  | 'USER_EXP'
  | 'USER_LEVEL'
  | 'USER_CORPCOIN'
  | 'USER_PERFORMANCE'
  | 'USER_FOUNDER'
  | 'COMPANY_PROFIT'
  | 'COMPANY_REVENUE'
  | 'COMPANY_WORKFORCE'
  | 'COMPANY_RETENTION'
  | 'COMPANY_RATING'
  | 'COMPANY_GROWTH'
  | 'COMPANY_LOSS_MAKING';

export const LEADERBOARD_CATEGORIES: readonly LeaderboardCategory[] = [
  'USER_EXP',
  'USER_LEVEL',
  'USER_CORPCOIN',
  'USER_PERFORMANCE',
  'USER_FOUNDER',
  'COMPANY_PROFIT',
  'COMPANY_REVENUE',
  'COMPANY_WORKFORCE',
  'COMPANY_RETENTION',
  'COMPANY_RATING',
  'COMPANY_GROWTH',
  'COMPANY_LOSS_MAKING',
] as const;

export type LeaderboardPeriod = 'ALL_TIME' | 'MONTHLY' | 'WEEKLY' | 'DAILY';
export const LEADERBOARD_PERIODS: readonly LeaderboardPeriod[] = [
  'ALL_TIME',
  'MONTHLY',
  'WEEKLY',
  'DAILY',
] as const;



