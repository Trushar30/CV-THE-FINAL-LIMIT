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
export type OnboardingStep = 'REGISTERED' | 'EMAIL_VERIFIED' | 'PROFILE_COMPLETED';
export const ONBOARDING_STEPS: readonly OnboardingStep[] = [
  'REGISTERED',
  'EMAIL_VERIFIED',
  'PROFILE_COMPLETED',
] as const;

// Career Domains
export type CareerDomain = 'SOFTWARE_ENGINEERING' | 'CLOUD_ENGINEERING' | 'AI_ENGINEERING';
export const CAREER_DOMAINS: readonly CareerDomain[] = [
  'SOFTWARE_ENGINEERING',
  'CLOUD_ENGINEERING',
  'AI_ENGINEERING',
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

export type ApplicationStatus = 'IN_PROGRESS' | 'REJECTED' | 'WITHDRAWN' | 'EXPIRED' | 'ACCEPTED';

export const APPLICATION_STATUSES: readonly ApplicationStatus[] = [
  'IN_PROGRESS',
  'REJECTED',
  'WITHDRAWN',
  'EXPIRED',
  'ACCEPTED',
] as const;

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
