import {
  DEFAULT_LEVEL_TABLE,
  LevelDefinition,
} from '../../config/platformConfig.schema.js';
import {
  PerformanceBand,
  PerformanceBandLabel,
} from '../../types/enums.js';

export interface LevelDetails {
  level: number;
  title: string;
  minExp: number;
  maxLevel: number;
  isMaxLevel: boolean;
  nextLevel: number | null;
  nextLevelTitle: string | null;
  nextLevelMinExp: number | null;
  currentLevelProgressExp: number;
  expNeededForNextLevel: number | null;
  progressPercentage: number;
  founderUnlocked: boolean;
}

export interface PerformanceBandDetails {
  band: PerformanceBand;
  label: PerformanceBandLabel;
  score: number;
  isWarningCandidate: boolean;
  isPerformanceIssue: boolean;
}

/**
 * Sanitize and clamp numeric scores between 0 and 100.
 * Safely handles strings, negative numbers, numbers > 100, NaN, null, undefined, and non-finite values.
 */
export function clampScore(score: unknown): number {
  let numScore: number;

  if (typeof score === 'number') {
    numScore = Number.isFinite(score) ? score : 0;
  } else if (typeof score === 'string') {
    const trimmed = score.trim();
    if (trimmed.length === 0) {
      numScore = 0;
    } else {
      const parsed = Number(trimmed);
      numScore = Number.isFinite(parsed) ? parsed : 0;
    }
  } else {
    numScore = 0;
  }

  if (numScore < 0) return 0;
  if (numScore > 100) return 100;
  return numScore;
}

/**
 * Sanitize and clamp EXP amounts to non-negative integers.
 * Safely handles strings, negative numbers, NaN, null, undefined, and non-finite values.
 */
export function sanitizeExp(exp: unknown): number {
  let numExp: number;

  if (typeof exp === 'number') {
    numExp = Number.isFinite(exp) ? exp : 0;
  } else if (typeof exp === 'string') {
    const trimmed = exp.trim();
    if (trimmed.length === 0) {
      numExp = 0;
    } else {
      const parsed = Number(trimmed);
      numExp = Number.isFinite(parsed) ? parsed : 0;
    }
  } else {
    numExp = 0;
  }

  return Math.max(0, Math.floor(numExp));
}

/**
 * Determine the user's level based on accumulated total EXP and the level table.
 * Derived from GEMINI.md Section 5 and Specification Section 10.
 * 
 * @param totalExp - Total accumulated EXP (permanent career capital)
 * @param levelTable - Optional level table; defaults to PlatformConfig DEFAULT_LEVEL_TABLE
 * @returns Level integer from 1 up to max level (default 10)
 */
export function levelForExp(
  totalExp: unknown,
  levelTable: LevelDefinition[] = DEFAULT_LEVEL_TABLE
): number {
  const exp = sanitizeExp(totalExp);
  const table = levelTable && levelTable.length > 0 ? levelTable : DEFAULT_LEVEL_TABLE;

  // Sort by minExp ascending to ensure deterministic progression
  const sorted = [...table].sort((a, b) => a.minExp - b.minExp);

  // Default to level of the lowest threshold entry
  let matchedLevel = sorted[0]?.level ?? 1;

  for (const entry of sorted) {
    if (exp >= entry.minExp) {
      matchedLevel = entry.level;
    } else {
      break;
    }
  }

  return matchedLevel;
}

/**
 * Calculate awarded task EXP deterministically from evaluation score and task maxExp.
 * Derived from Specification Section 10.3:
 * awardedExp = round((score / 100) * task.maxExp), strictly clamped to 0..task.maxExp.
 * 
 * @param score - Evaluation score from AI or user submission (0–100)
 * @param maxExp - Maximum EXP allowed for the task difficulty tier (e.g. 30, 60, 100)
 * @returns Integer awarded EXP between 0 and maxExp
 */
export function calculateTaskExp(score: unknown, maxExp: unknown): number {
  const validScore = clampScore(score);
  const validMaxExp = sanitizeExp(maxExp);

  if (validMaxExp === 0) {
    return 0;
  }

  const rawExp = Math.round((validScore / 100) * validMaxExp);
  return Math.max(0, Math.min(validMaxExp, rawExp));
}

/**
 * Map an evaluation score to its authoritative performance score band.
 * Derived from GEMINI.md Section 5 and Specification Section 11.1:
 * - 90–100: EXCELLENT
 * - 75–89:  GOOD
 * - 60–74:  ACCEPTABLE
 * - 40–59:  NEEDS_IMPROVEMENT
 * - 0–39:   POOR
 * 
 * @param score - Evaluation score (clamped to 0–100)
 * @returns PerformanceBand enum string
 */
export function performanceBand(score: unknown): PerformanceBand {
  const validScore = clampScore(score);

  if (validScore < 40) {
    return 'POOR';
  }
  if (validScore < 60) {
    return 'NEEDS_IMPROVEMENT';
  }
  if (validScore < 75) {
    return 'ACCEPTABLE';
  }
  if (validScore < 90) {
    return 'GOOD';
  }
  return 'EXCELLENT';
}

/**
 * Map an evaluation score to its human-readable performance band label.
 */
export function performanceBandLabel(score: unknown): PerformanceBandLabel {
  const band = performanceBand(score);

  switch (band) {
    case 'POOR':
      return 'Poor';
    case 'NEEDS_IMPROVEMENT':
      return 'Needs Improvement';
    case 'ACCEPTABLE':
      return 'Acceptable';
    case 'GOOD':
      return 'Good';
    case 'EXCELLENT':
      return 'Excellent';
  }
}

/**
 * Retrieve comprehensive details about a score's performance band.
 */
export function getPerformanceBandDetails(score: unknown): PerformanceBandDetails {
  const validScore = clampScore(score);
  const band = performanceBand(validScore);
  const label = performanceBandLabel(validScore);

  return {
    band,
    label,
    score: validScore,
    isWarningCandidate: validScore <= 39,
    isPerformanceIssue: validScore >= 40 && validScore <= 59,
  };
}

/**
 * Retrieve comprehensive level details, progress metrics, and Founder unlock status.
 * 
 * @param totalExp - Total accumulated EXP
 * @param levelTable - Optional level table; defaults to PlatformConfig DEFAULT_LEVEL_TABLE
 * @param founderUnlockExp - EXP required for Founder Mode (default: 12000)
 */
export function getLevelDetails(
  totalExp: unknown,
  levelTable: LevelDefinition[] = DEFAULT_LEVEL_TABLE,
  founderUnlockExp: number = 12000
): LevelDetails {
  const exp = sanitizeExp(totalExp);
  const table = levelTable && levelTable.length > 0 ? levelTable : DEFAULT_LEVEL_TABLE;
  const sorted = [...table].sort((a, b) => a.level - b.level);

  const currentLevel = levelForExp(exp, sorted);
  const maxLevel = sorted[sorted.length - 1]?.level ?? 10;
  const isMaxLevel = currentLevel >= maxLevel;

  const currentDef =
    sorted.find((entry) => entry.level === currentLevel) ??
    sorted[0] ??
    { level: 1, title: 'Intern', minExp: 0 };

  const nextDef = !isMaxLevel
    ? sorted.find((entry) => entry.level === currentLevel + 1) ?? null
    : null;

  let currentLevelProgressExp = 0;
  let expNeededForNextLevel: number | null = null;
  let progressPercentage = 100;

  if (nextDef) {
    const range = nextDef.minExp - currentDef.minExp;
    currentLevelProgressExp = Math.max(0, exp - currentDef.minExp);
    expNeededForNextLevel = Math.max(0, nextDef.minExp - exp);
    progressPercentage =
      range > 0
        ? Math.min(100, Math.max(0, Math.round((currentLevelProgressExp / range) * 100)))
        : 100;
  } else {
    currentLevelProgressExp = Math.max(0, exp - currentDef.minExp);
    expNeededForNextLevel = null;
    progressPercentage = 100;
  }

  return {
    level: currentLevel,
    title: currentDef.title,
    minExp: currentDef.minExp,
    maxLevel,
    isMaxLevel,
    nextLevel: nextDef ? nextDef.level : null,
    nextLevelTitle: nextDef ? nextDef.title : null,
    nextLevelMinExp: nextDef ? nextDef.minExp : null,
    currentLevelProgressExp,
    expNeededForNextLevel,
    progressPercentage,
    founderUnlocked: exp >= founderUnlockExp,
  };
}
