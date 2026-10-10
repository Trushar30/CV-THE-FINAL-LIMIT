import { z } from 'zod';
import {
  CAREER_DOMAINS,
  type CareerDomain,
  LEADERBOARD_CATEGORIES,
  type LeaderboardCategory,
  LEADERBOARD_PERIODS,
  type LeaderboardPeriod,
} from '../types/enums.js';

export const getLeaderboardQuerySchema = z.object({
  category: z
    .enum(LEADERBOARD_CATEGORIES as unknown as [LeaderboardCategory, ...LeaderboardCategory[]])
    .default('USER_EXP'),
  period: z
    .enum(LEADERBOARD_PERIODS as unknown as [LeaderboardPeriod, ...LeaderboardPeriod[]])
    .default('ALL_TIME'),
  page: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 1))
    .pipe(z.number().int().min(1).default(1)),
  limit: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 20))
    .pipe(z.number().int().min(1).max(100).default(20)),
  domain: z
    .enum(CAREER_DOMAINS as unknown as [CareerDomain, ...CareerDomain[]])
    .optional(),
});

export const refreshLeaderboardSchema = z.object({
  category: z
    .enum(LEADERBOARD_CATEGORIES as unknown as [LeaderboardCategory, ...LeaderboardCategory[]])
    .optional(),
  period: z
    .enum(LEADERBOARD_PERIODS as unknown as [LeaderboardPeriod, ...LeaderboardPeriod[]])
    .optional()
    .default('ALL_TIME'),
});

export type GetLeaderboardQuery = z.infer<typeof getLeaderboardQuerySchema>;
export type RefreshLeaderboardInput = z.infer<typeof refreshLeaderboardSchema>;
